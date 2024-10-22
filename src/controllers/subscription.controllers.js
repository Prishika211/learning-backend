import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.models.js"
import { Subscription } from "../models/subscription.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    const subscriberId = req.user?._id;

    if(!isValidObjectId(channelId) || !isValidObjectId(subscriberId)){
        throw new ApiError (
            400,
            "Invalid Channel ID or Subscriber ID"
        )
    }

    if(channelId === subscriberId.toString()) {
        throw new ApiError(
            400,
            "You cannot subscribe to your own channel"
        )
    }

    const existingSubscription = await Subscription.findOne({
        channel: channelId,
        subscriber: subscriberId
    })

    let responseMessage;
    try {
        if(!existingSubscription){
            await Subscription.create({
                channel: channelId,
                subscriber: subscriberId
            })
            responseMessage = "Subscribed successfully"
        }
        else {
            await Subscription.deleteOne({
                channel: channelId,
                subscriber: subscriberId
            })
            responseMessage = "Unsubscribed successfully"
        }
    } catch (error) {
        throw new ApiError(
            500,
            "Error while toggling subscription"
        )
    }

    const totalSubscribers = await Subscription.countDocuments({channel: channelId});

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {totalSubscribers},
            responseMessage
        )
    )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(
            400,
            "Invalid Channel ID"
        )
    }
    
    const channel = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(`${channelId}`)
            }
        }
    ])

    const subscriberCount = channel.length;

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            subscriberCount,
            "Successfully fetched number of subscriber of the given channel ID"
        )
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId} = req.params

    if(!isValidObjectId(subscriberId)){
        throw new ApiError(
            400,
            "Invalid Subscriber ID"
        )
    }

    const subscribedChannels = await Subscription.find({
        subscriber: subscriberId
    })
    .populate("channel", "username fullName avatar decription")
    .sort({createdAt: -1})

    if(!subscribedChannels || subscribedChannels.length === 0){
        return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                [],
                "No subscribed channels found"
            )
        )
    }

    return res.status(200)
    .json(new ApiResponse
        (
            200, 
            subscribedChannels,
            "Subscribed channels fetched successfully"
        )
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}