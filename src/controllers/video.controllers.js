import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId, random=false } = req.query
    
    //Build filters
    const filters={};
    // "query" refers to a search term provided by the user, typically passed through a query string (query=funny)

    if (query) filters.title = {
        $regex: query, //specifies that we are searching using a pattern (query- string)
        $options: "i" //case-insensitive, meaning it will match regardless of the case(uppercase or lowercase)
    };

    if (userId && isValidObjectId(userId)) filters.owner = mongoose.Types.ObjectId(userId);

    try {
        let videoPipeline = [
            {
                $match: filters
            },
            {
                $lookup: {
                    from : "users",
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
                $addFields: {
                    details: {
                        $first: "$details"
                    }
                }
            },
            {
                $sort: {
                    [sortBy]: sortType === "desc" ? -1 : 1
                }
            },
            {
                $skip: (page -1) * limit
            },
            {
                $limit: parseInt(limit)
            }
        ]

        //Add random sampling if requested
        if (random === "true"){
            videoPipeline.unshift({
                $sample: {
                    size: parseInt(limit)
                }
            })
            videoPipeline.splice(3, 1);
        }

        //execute the pipeline
        const videos = await Video.aggregate(videoPipeline);

        const totalVideos = await Video.countDocuments(filters);


        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    videos,
                    page: parseInt(page),
                    totalPages: Math.ceil(totalVideos / limit),
                    totalVideos
                },
                "Videos fetched successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            500,
            "Error fetching videos"
        )
    }
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path
    const videoFileLocalPath = req.files?.videoFile[0]?.path

    if([title, description, thumbnailLocalPath, videoFileLocalPath].some(
        (field) => field.trim() === ""
    )){
        throw new ApiError(
            400,
            "All fields are required"
        )
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    const videoFile = await uploadOnCloudinary(videoFileLocalPath)

    if(!thumbnail){
        throw new ApiError(
            400,
            "Thumbnail link is required"
        )
    }

    if(!videoFile){
        throw new ApiError(
            400,
            "VideoFile link is required"
        )
    }

    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: videoFile.duration,
        isPublished: true,
        owner: req.user?._id
    })

    if(!video){
        throw new ApiError(
            500,
            "Something went wrong while uploading the video"
        )
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            video,
            "Video published successfully"
        )
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if(!isValidObjectId(videoId)){
        throw new ApiError(
            400,
            "Invalid Video ID"
        )
    }

    try {
        const video = await Video
        .findById(videoId)
        .populate("owner", "username fullName avatar")

        if(!video) {
            throw new ApiError(
                404, "Video not found"
            )
        }

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video, 
                "Video fetched successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            500,
            "Erro fetching video"
        )
    }
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const {title, description} = req.body;
    const {file} = req.file

    if(!isValidObjectId(videoId)){
        throw new ApiError(
            400,
            "Invalid Video ID"
        )
    }

    const video = await Video.findById(videoId);
    if(!video){
        throw new ApiError(
            404,
            "Video not found"
        )
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(
            403,
            "Unauthorized to update this video"
        )
    }

    if(!title && !description && !file){
        throw new ApiError(
            400,
            "At least one field (title, description, or thumbnail) is required for update"
        )
    }

    if(file){
        const thumbnailFileUrl = await uploadOnCloudinary(file.path, "image")

        if(!thumbnailFileUrl){
            throw new ApiError(
                400,
                "Error uploading thumbnail to Cloudinary"
            )
        }

        video.thumbnail = thumbnailFileUrl
    }

    video.title = title || video.title;
    video.description = description || video.description

    await video.save();

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            video, "Video updated successfully"
        )
    )

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if(!isValidObjectId(videoId)) {
        throw new ApiError(
            400,
            "Invalid Video ID"
        )
    }

    const video = await Video.findById(videoId);
    if(!video){
        throw new ApiError(
            404,
            "Video not found"
        )
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(
            403,
            "Unauthorized to delete this video"
        )
    }

    await video.deleteOne();

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Video deleted successfully"
        )
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(
            400,
            "Invalid Video ID"
        )
    }

    const video = await Video.findById(videoId);
    if(!video){
        throw new ApiError(
            404,
            "Video not found"
        )
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(
            403,
            "Unauthorized to update publish status"
        )
    }

    video.isPublished = !video.isPublished; // toggle the publish status
    await video.save(); //save the updated video

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            video,
            "Video publish status updated successfully"
        )
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}