import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    try{
        const {name, description} = req.body

        if(!name && !description){
            throw new ApiError(
                400, 
                "Name and decription are required"
            )
        }

        const newPlaylist = await Playlist.create(
            {
                name,
                description,
                owner:req.user?._id
            }
        )

        if(!newPlaylist){
            throw new ApiError(
                500, "Error while creating playlist schema"
            )
        }

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                newPlaylist,
                "Playlist has been created"
            )
        )
    } catch (error) {
        throw new ApiError(
            400, 
            error.message || "Things didn't go write while creating playlist"
        )
    }

})

const getUserPlaylists = asyncHandler(async (req, res) => {
    try{
        const {userId} = req.params
    
        if(!isValidObjectId(userId)){
            throw new ApiError(400, "Invalid user ID");
        }

        const findPlaylists = await Playlist.aggregate(
            [
                {
                    $match: {
                        owner: new mongoose.Types.ObjectId(String(userId))
                    }
                },
                {
                    $lookup: {
                        from: "videos",
                        localField: "videos",
                        foreignField: "_id",
                        as: "videos",
                        pipeline: [
                            {
                                $lookup: {
                                    from: "users",
                                    localField: "owner",
                                    foreignField: "_id",
                                    as: "owner"
                                }
                            },
                            {
                                $addFields: {
                                    owner: {
                                        $first: "$owner"
                                    }
                                }
                            },
                            {
                                $project: {
                                    title: 1,
                                    thumbnail: 1,
                                    description: 1,
                                    owner: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            }
                        ]
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "createdBy",
                        pipeline: [
                            {
                                foreignField: "_id",
                                as: "createdBy",
                                pipeline: [
                                    {
                                       $project: {
                                        avatar: 1,
                                        fullName: 1,
                                        username: 1
                                       } 
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    $addFields: {
                        createdBy: { 
                            $first: "$createdBy" 
                        },
                    }
                }, 
                {
                    $project: {
                        videos: 1,
                        createdBy: 1,
                        name: 1,
                        description: 1
                    }
                }
            ]
        )
        if(!findPlaylists){
            throw new ApiError(404, "the required playlist is not found for this user")
        }

        return res
        .status(200)
        .json(new ApiResponse(
            200, 
            findPlaylists,
            "User's playlists retrieved"
        ))
    } catch (error) {
        throw new ApiError(
            400, 
            error.message || "Error while getting User Playlist"
        )
    }
    
})

const getPlaylistById = asyncHandler(async (req, res) => {
    try{
        const {playlistId} = req.params
    
        if(!isValidObjectId(playlistId)){
            throw new ApiError(
                400, 
                "Invalid playlist ID")
        }
        

        const foundPlaylist = await Playlist.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(String(playlistId))
                }
            },
            {
                $lookup:{
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "createdBy",
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
                    createdBy: {
                        $first: "$createdBy"
                    }
                }
            },
            {
                $lookup: {
                    from: "videos",
                    foreignField: "_id",
                    localField: "videos",
                    as: "videos",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner"
                            }
                        },
                        {
                            $addFields: {
                                owner: {
                                    $first: "$owner"
                                }
                            }
                        },
                        {
                            $project: {
                                thumbnail: 1,
                                title: 1,
                                duration: 1,
                                views: 1,
                                owner: {
                                    fullName: 1,
                                    username: 1, 
                                    avatar: 1,
                                },
                                createdAt: 1, 
                                updatedAt: 1
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1, 
                    videos: 1, 
                    createdBy: 1
                }
            }
        ])

        if(!foundPlaylist[0]){
            throw new ApiError(404, "Playlist not found")
        }

        return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                foundPlaylist[0],
                "Playlist retrieved successfully"
            )
        )
    } catch (error) {
        throw new ApiError(
            400,
            error.message || "Error while getting playlist by ID"
        )
    }
    
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    try{
        const {playlistId, videoId} = req.params

        if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
            throw new ApiError(
                400, 
                "Invalid playlist or video ID"
            );
        }
    
        const playList = await Playlist.findById(playlistId);
    
        if(!playList){
            throw new ApiError(
                400,
                "Playlist not found"
            )
        }
    
        if(!(playList.owner).equals(req.user?._id)){
            throw new ApiError(
                400,
                "You cannot add video in this playlist"
            )
        }

        const found = (playList.videos).filter(video => video.toString() === videoId)

        if(found.length > 0){
            throw new ApiError(
                400,
                "Video is already in the playlist"
            )
        }

        const newVideo = [...(playList.videos), videoId]

        const newPlaylist = await Playlist.findByIdAndUpdate(
            playList._id,
            {
                $set: {
                    videos: newVideo
                }
            },
            {
                new: true
            }
        )

        if(!newPlaylist){
            throw new ApiError(
                500, 
                "Error while Adding new video"
            )
        }
    
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                newPlaylist,
                "Video added to playlist"
            )
        )
    } catch (error) {
        throw new ApiError(
            400,
            error.message || "Error while adding video to playlist"
        )
    }
    
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    try{
        const {playlistId, videoId} = req.params
    
        if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
            throw new ApiError(400, "Invalid playlist or video ID")
        }

        const playList = await Playlist.findById(playlistId)

        if(!playList){
            throw new ApiError(
                400, 
                "Playlist not found"
            )
        }

        if(!((playList.owner).equals(req.user?._id))){
            throw new ApiError(
                400,
                "You cannot delete it"
            )
        }

        const newPlayListVideo = (playList.videos).filter(v => v.toString() !== videoId)
        
        const updatePlayListVideo = Playlist.findByIdandUpdate(
            playList._id,
            {
                $set:{
                    videos: newPlayListVideo
                }
            },
            {new: true}
        )

        if(!updatePlayListVideo){
            throw new ApiError(
                500,
                "Error while removing video from playlist"
            )
        }

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatePlayListVideo, 
                "Video removed from playlist"
            )
        )
    } catch (error){
        throw new ApiError(
            400,
            error.message || "Error while removing playlist"
        )
    }
    
})

const deletePlaylist = asyncHandler(async (req, res) => {
    try{
        const {playlistId} = req.params
    
        if(!isValidObjectId(playlistId)){
            throw new ApiError(
                400, 
                "Invalid playlist ID"
            )
        }

        const findPlaylist = await Playlist.findById(playlistId);

        if(!findPlaylist){
            throw new ApiError(
                404, 
                "Playlist not found"
            )
        }

        if(!((findPlaylist.owner).equals(req.user?._id))){
            throw new ApiError(
                400,
                "You cannot delete it"
            )
        }

        const deletedPlaylist = await Playlist.findByIdAndDelete(findPlaylist._id)

        if(!deletedPlaylist){
            throw new ApiError(
                500,
                "Error while deleting vod"
            )
        }

        return res
        .status(200)
        .json(
            200,
            deletedPlaylist, 
            "Playlist deleted successfully"
        )
    } catch (error) {
        throw new ApiError(
            400,
            error.message || 
            "Things didn't go write while deleting playlist"
        )
    }
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    
    if(!isValidObjectId(playlistId)){
        throw new ApiError(
            400, 
            "Invalid playlist ID"
        )
    }

    if(!name || !description){
        throw new ApiError(
            400,
            "please fill required details"
        )
    }

    const findPlaylist = await Playlist.findById(playlistId);

    if(!findPlaylist){
        throw new ApiError(
            400,
            "Playlist not found"
        )
    }

    if(!((findPlaylist.owner).equals(req.user?._id))){
        throw new ApiError(
            403, 
            "You are not authorized to upadae this playlist"
        )
    }
  
    const updatedPlaylist = await Playlist.findByIdandUpdate(
        playlistId,
        {
            $set: {
                name,
                description
            }
        },
        {
            new: true,
            runValidators: true
        }
    )

    if(!updatedPlaylist){
        throw new ApiError(
            404, 
            "Playlist not found"
        )
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedPlaylist,
            "Playlist updated successfully"
        )
    )
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}