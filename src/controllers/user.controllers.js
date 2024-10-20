import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { deleteFile } from "../utils/FileUtils.js";
import mongoose from "mongoose";

const generateAcessandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAcessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // 1. get user details from frontend
  // 2. validation - not empty
  // 3. check if user already exists: username, email
  // 4. check for images, check for avatar
  // 5. upload them to cloudinary, avatar
  // 6. create user object- create entry in db
  // 7. remove password and refresh token field from response
  // 8. check for user creation
  // 9. return res

  // 1.
  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  // 2.
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // 3.
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // 4.
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // 5.
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // 6.
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // 7.
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // 8.
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // 9.
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // check for existence of username and email
  // find the user
  // password check
  // access and refresh token
  // send cookie
  // return res

  const { username, email, password } = req.body;
  console.log(email);

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAcessandRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1 // this removes the field from document
      }
    },
    {
      new: true,
    }
  )

  const options = {
    httpOnly: true,
    secure: true,
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
})

const refreshAccessToken = asyncHandler(async(req, res)=> {
  const incomingRefreshtoken = req.cookies.refreshToken || req.body.refreshToken;

  if(!incomingRefreshtoken){
    throw new ApiError(401, "unauthorized request")
  }

  try{
    //decoding the incomingRefreshToken received from user
    const decodedToken = jwt.verify(
      incomingRefreshtoken,
      process.env.REFRESH_TOKEN_SECRET
    )

    //find the decodedToken id in the User
    const user = await User.findById(decodedToken?._id);

    if(!user){
      throw new ApiError(401, "Invalid refresh token")
    }

    //matching the tokens
    if(incomingRefreshtoken !== user?.refreshToken){
      throw new ApiError(401, "Refresh token is expired or used")
    }

    //generating new tokens
    const options = {
      httpOnly: true,
      secure: true
    }

    const {accessToken, newRefreshToken} =  await generateAcessandRefreshToken(user._id)

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        {accessToken, refreshToken:
          newRefreshToken},
        "Access token refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
  
})

const changeCurrentPassword = asyncHandler(async (req, res)=> {
  const {oldPassword, newPassword} = req.body

  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new ApiError(400, "Invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res
  .status(200)
  .json(
    new ApiResponse(200, {}, "Password changed successfully"
  )
)
   
})

const getCurrentUser = asyncHandler(async (req, res)=>{
  return res
  .status(200)
  .json(
    200, req.user, "current user fetched successfully"
  )
})

const updateAccountDetails = asyncHandler(async ( req, res)=>{
  const {fullName, email} = req.body

  if(!fullName && !email){
    throw new ApiError(400, "All fields are required")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email
      }
    },
    {
      new: true
    }
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(
      200, 
      user, "Account details updated successfully"
    )
  )
})

const updateUserAvatar = asyncHandler(async (req, res)=> {
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400, "Error while uploading on avatar")
  }

  //find the user to get the old avatar
  const user = await User.findById(req.user?._id);

  //Save the new avatar URL in the database
  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {new: true}
  ).select("-password")


  //If the user has an old avatar, delete the old avatar file from local storage
  if(user?.avatar && avatarLocalPath){
    try{
      await deleteFile(user.avatar);
    } catch(error){
      console.log("Failed to delete old avatar: ", error);
    }
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, updatedUser, "Avatar image updated successfully")
  )
})


const updateUserCoverImage = asyncHandler(async (req, res)=> {
  const coverImageLocalPath = req.file?.path

  if(!coverImageLocalPath){
    throw new ApiError(400, "Cover image file is missing")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400, "Error while uploading on Cover Image")
  }

  const user = await User.findById(req.user?._id);

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    {new: true}
  ).select("-password")

  if(user?.coverImage && coverImageLocalPath){
    try{
      await deleteFile(user.coverImage);
    } catch(error){
      console.log("Failed to delete old cover image: ", error);
    }
  }
  
  return res
  .status(200)
  .json(
    new ApiResponse(200, updatedUser, "Cover image updated successfully")
  )
})

const getUserChannelProfile = asyncHandler(async (req, res)=>{
  const {username}=req.params

  if(!username?.trim()){
    throw new ApiError(400, "username is missing")
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1
      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(404, "channel does not exist")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, channel[0], "User channel fetched successfully")
  )
})

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(String(req.user._id))
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
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
                    avatar: 1,
                    
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner:{
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      user[0].watchHistory,
      "Watch history fetched successfully"
    )
  )
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory};
