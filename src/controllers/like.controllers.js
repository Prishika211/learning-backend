import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.models.js"
import {Comment} from "../models/comment.models.js"
import {Tweet} from "../models/tweet.models.js"

// In-memory cache for total likes
const likeCache = {};

//Helper function to toggle like
const toggleLike = async(Model, resourceID, userID) => {
    if(!isValidObjectId(resourceID)){
        throw new ApiError(
            400, 
            "Invalid Resource ID"
        )
    }

    if(!isValidObjectId(userID)){
        throw new ApiError(
            400, 
            "Invalid User ID"
        )
    }

    const model = Model.modelName.toLowerCase();

    const isLiked = await Like.findOne({
        [model]: resourceID,
        likedBy: userID
    });

    let response;
    try { 
        if(!isLiked){
            //User hasn't liked yet, so create a like entry
            response = await Like.create({
                [model]: resourceID,
                likedBy: userID
            })

            // invalidate the cache for total likes
            delete likeCache[resourceID]
        } else {
            //User has already liked, so remove the like entry
            response = await Like.deleteOne({
                [model]: resourceID,
                likedBy: userID
            })

            // invalidate the cache for total likes
            delete likeCache[resourceID]
        }
    } catch (error) {
        throw new ApiError(500, "Database error during toggle like operation")
    }

    let totalLikes;

    // check if we already have cached total likes for this resource
    if(likeCache[resourceID]){
        totalLikes = likeCache[resourceID]
    } else {
        try {
            // count total likes if not cached
            totalLikes = await Like.countDocuments({
                [model]: resourceID
            })

            likeCache[resourceID] = totalLikes;
        } catch (error) {
            throw new ApiError(
                500, 
                "Error counting total likes"
            )
        }
    }

    return {response, isLiked, totalLikes};
}
const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    
    try{
        const {isLiked, totalLikes} = await toggleLike(
            Video,
            videoId,
            req.user?._id
        )

        return res
        .status(200)
        .json(new ApiResponse(
            200,
            {totalLikes}, 
            !isLiked ? "Liked successfully" : "Like removed successfully"
        ))
    } catch (error) {
        throw new ApiError(
            500,
            error.message || "Unexpected error occurred"
        )
    }
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    
    try{
        const {isLiked, totalLikes} = await toggleLike(
            Comment,
            commentId,
            req.user?._id
        )

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {totalLikes},
                isLiked ? "Like removed" : "Liked successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            500,
            error.message || "Unexpected error occurred"
        )
    }


})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    try{
        const {isLiked, totalLikes} = await toggleLike(
            Tweet,
            tweetId,
            req.user?._id
        )

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {totalLikes},
                isLiked ? "Like removed" : "Liked successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            500,
            error.message || "Unexpected error occurred"
        )
    }
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    const userID = req.user?._id

    if(!isValidObjectId(userID)){
        throw new ApiError(
            401,
            "Invalid userID"
        )
    }

    const likedVideo = await Like.aggregate([
        {
            $match: {
                $and: [
                    {
                        likedBy: new mongoose.Types.ObjectId(`${userID}`)  
                    },
                    {
                        video: {$exists: true}
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1, 
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                details: {
                    $first: "$video"
                }
            }
        }
    ])

    if(!likedVideo || likedVideo.length === 0){
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                [],
                "No liked videos found"
            )
        )
    }

    return  res
    .status(200)
    .json(
        new ApiResponse(
            200,
            likedVideo,
            "Liked videos fetched successfully"
        )
    )
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}