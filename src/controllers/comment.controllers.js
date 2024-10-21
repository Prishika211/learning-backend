import mongoose, {isValidObjectId} from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!isValidObjectId(videoId)){
        throw new ApiError(
            400,
            "Invalid video ID"
        )
    }
    let getAllComments;
    try{
        getAllComments = await Comment.aggregate([
            {
                $match: {
                    video: new mongoose.Types.ObjectId(String(videoId))
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "details",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                avatar: 1,
                                username: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "likes",
                    localField: "owner",
                    foreignField: "likedBy",
                    as: "likes",
                    pipeline: [
                        {
                            $match: {
                                comment: {$exists: true}
                            }
                         }
                    ]
                }
            },
            {
                $addFields: {
                    details: {
                        $first: "$details"
                    }
                }
            },
            {
                $addFields: {
                    likes: {
                        $size: "$likes"
                    }
                }
            },
            {
                $skip: (page-1)*limit
            },
            {
                $limit: parseInt(limit)
            }
        ])
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while fetching comments"
        )
    }  

    const result = await Comment.aggregatePaginate(getAllComments, {
        page, limit
    })

    if(result.docs.length === 0){
        return res.status(200).
        json(new ApiResponse(
            200,
            [],
            "No comments found for this video"
        ))
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            result.docs,
            "Comments retrieved successfully"
        )
    )
    
})

const addComment = asyncHandler(async (req, res) => {
    const {videoId} = req.params;
    const {content} = req.body;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID")
    }

    if(!content || content.trim() === ""){
        throw new ApiError(400, "Comment content is required")
    }

    const newComment = await Comment.create({
        video: videoId,
        owner: req.user?._id,
        content,
    })

    if(!newComment){
        throw new ApiError(
            400,
            "Something went wrong while adding comment"
        )
    }
    return res
    .status(200)
    .json(
        new ApiResponse(
            201,
            newComment,
            "Comment added successfully"
        )
    )
})

const updateComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params;
    const {content} = req.body;

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid comment ID")
    }

    if(!content || content.trim()===""){
        throw new ApiError(400, "Updated content is required")
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            content
        },
        {new: true}
    )

    if(!updatedComment){
        throw new ApiError(
            404, "Comment not found"
        )
    }

    if(!updatedComment.owner.equals(req.user?._id)){
        throw new ApiError(
            403, "You can only update your own comments"
        )
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            updatedComment, 
            "Comment updated successfully"
        )
    )
})

const deleteComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params;

    if(!isValidObjectId(commentId)){
        throw new ApiError(
            400, "Invalid comment ID"
        )
    }

    const comment = await Comment.findById(commentId);

    if(!comment){
        throw new ApiError(
            404, "Comment not found"
        )
    }

    if(!comment.owner.equals(req.user?._id)){
        throw new ApiError(403, "You can only delete your own comments")
    }

    await comment.deleteOne();

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        null, 
        "Comment deleted successfully"
    ))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }