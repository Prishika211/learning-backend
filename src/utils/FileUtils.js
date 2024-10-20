import fs from "fs";
import path from "path";

const deleteFile = (fileUrl, baseDir = '..')=>{
    return new Promise((resolve, reject)=>{
        const filePath = path.join(__dirname, baseDir, 'uploads', path.basename(fileUrl));

        fs.unlink(filePath, (err)=>{
        if(err){
            console.error("Error deleting old avatar: ", err);
            return reject(err);
        }else {
            console.log("Old avatar deleted successfully");
            resolve();
        }   
        });
    })
}

export {deleteFile}