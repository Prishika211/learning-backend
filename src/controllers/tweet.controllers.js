import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    try{
        const {content} = req.body;
        const userId = req.user?._id;

        if(content?.trim() === ""){
            throw new ApiError(
                400,
                "Tweet content is required"
            )
        }

        const newTweet = await Tweet.create({
            content, 
            owner: userId
        })

        if(!newTweet){
            throw new ApiError(
                500,
                "Failed to create tweet"
            )
        }

        return res
        .status(200)
        .json(
            new ApiResponse(
                201, 
                newTweet,
                "Tweet created successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            400, 
            error.message || "Failed to create tweet"
        )
    }
})

const getUserTweets = asyncHandler(async (req, res) => {
    try {
        const {userId} = req.params;

        if(!isValidObjectId(userId)){
            throw new ApiError(
                400,
                "Invalid user ID"
            )
        }

        // const userTweets = await Tweet
        // .find({
        //     owner: userId
        // })
        // .populate("owner", "username fullName avatar") // to access additional information from the user
        // .sort({createdAt: -1}); // sorting by newest tweets

        //or 

        const userTweets = await Tweet.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(`${userId}`)
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
                                avatar: 1,
                                fullName: 1,
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "tweet",
                    as: "numLikes"
                }
            },
            {
                $addFields: {
                    details: {
                        $first: "$details"
                    },
                    likes: {
                        $size: "$numLikes"
                    }
                }
            }
        ])

        if(!userTweets.length){
            throw new ApiError(
                404,
                "No tweets found for this user"
            )
        }

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                userTweets,
                "User tweets retrieved successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            400,
            error.message || "Error while fetching user tweets"
        )
    }
})

const updateTweet = asyncHandler(async (req, res) => {
    try{
        const {tweetId} = req.params;
        const {content} = req.body;

        if(!isValidObjectId(tweetId)){
            throw new ApiError(
                400, 
                "Invalid tweet ID"
            )
        }

        if(content?.trim() === ""){
            throw new ApiError(
                400,
                "Content is missing"
            )
        }
        const tweet = await Tweet.findById(tweetId);

        if(!tweet){
            throw new ApiError(
                404,
                "Tweet not found"
            )
        }

        if(!(tweet.owner.equals(req.user?._id))){
            throw new ApiError(
                403, 
                "You can only update your own tweets"
            )
        }

        tweet.content = content;
        await tweet.save();

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                tweet,
                "Tweet updated successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            400,
            error.message || "Error while updating tweet"
        )
    }
})

const deleteTweet = asyncHandler(async (req, res) => {
    try {
        const {tweetId} = req.params;

        if(!isValidObjectId(tweetId)){
            throw new ApiError(
                400,
                "Invalid tweet ID"
            )
        }

        const tweet = await Tweet.findById(tweetId)

        if(!tweet){
            throw new ApiError(
                404,
                "Tweet not found"
            )
        }

        if(!(tweet.owner.equals(req.user?._id))){
            throw new ApiError(
                403,
                "You can only delete your own tweets"
            )
        }

        await tweet.deleteOne();

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "Tweet deleted successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            400,
            error.message || "Error while deleting tweet"
        )
    }
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}