import mongoose, {isValidObjectId, mongo} from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const {channelId} = req.params;

    if(!isValidObjectId(channelId)){
        throw new ApiError(
            400,
            "Invalid Channel ID"
        )
    }

    try {
        const totalVideos = await Video.countDocuments({owner: channelId})

        const totalViews = await Video.aggregate([
            {
                $match: {
                    owner: mongoose.Types.ObjectId(channelId),
                },
            },
            {
                $group: {
                    _id: null,
                    totalViews: {
                        $sum: "$views"
                    }
                }
            }
        ])

        const totalLikes = await Like.countDocuments({
            video: {
                $in: await Video.find(
                    {
                        owner: channelId
                    }
                )
                .select('_id')
            }
        })

        const totalSubscribers = await Subscription.countDocuments({
            channel: channelId
        })

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    totalVideos,
                    totalViews: totalViews[0]?.totalViews || 0,
                    totalLikes,
                    totalSubscribers
                },
                "Channel sats fetched successfully"
            )
        )

    } catch (error) {
        throw new ApiError(
            500,
            "Failed to fetch channel stats"
        )
    }
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const {channelId} = req.params;
    const {page=1, limit=10} = req.query;

    if(!isValidObjectId(channelId)){
        throw new ApiError(
            400,
            "Invalid Channel ID"
        )
    }

    try {
        const videos = await Video.aggregate([
            {
                $match: {
                    owner: mongoose.Types.ObjectId(channelId),
                    isPublished: true
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }, 
            {
                $skip: (page - 1) * limit
            },
            {
                $limit: parseInt(limit)
            }
        ])

        const totalVideos = await Video.countDocuments({
            owner: channelId,
            isPublished: true
        })

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
                "Channel videos fetched successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            500,
            "Failed to fetch channel videos"
        )
    }
})

export {
    getChannelStats, 
    getChannelVideos
    }