const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Connected successfully using the secure API key provided
cloudinary.config({ 
  cloud_name: 'ddc1ue0f8', 
  api_key: '353494569843198', 
  api_secret: 'q8EwyEpL0bo9-uN_uxDy6ZZOAMY' 
});

function getAllTargetFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file.startsWith('.')) continue; // skip modules and hidden git/env files
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllTargetFiles(filePath, fileList);
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function uploadAndReplace() {
  const targetFiles = getAllTargetFiles('.');
  const videoRegex = /(?:src|href|poster)=['"]([^'"]+\.mp4)['"]/gi;
  
  // Find all references
  const localVideosToUpload = new Set();
  
  targetFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = videoRegex.exec(content)) !== null) {
      const vidPath = match[1];
      if (!vidPath.startsWith('http') && !vidPath.startsWith('//')) {
          const fullDiskPath = path.resolve(path.dirname(file), decodeURIComponent(vidPath));
          if (fs.existsSync(fullDiskPath)) {
             localVideosToUpload.add(JSON.stringify({
                 originalRef: vidPath,
                 fullDiskPath: fullDiskPath
             }));
          }
      }
    }
  });

  const uploadMap = {}; // Maps originalRef perfectly to Cloudinary URL
  const videosArray = Array.from(localVideosToUpload).map(JSON.parse);

  console.log(`[Julsona Automater] Found ${videosArray.length} unique local videos embedded inside the code...`);
  
  for (let i = 0; i < videosArray.length; i++) {
    const { originalRef, fullDiskPath } = videosArray[i];
    console.log(`\n[${i+1}/${videosArray.length}] Pushing -> ${originalRef}`);
    console.log(`(This might take a few minutes for large video files due to internet upload speed, please wait...)`);
    
    try {
        const result = await cloudinary.uploader.upload(fullDiskPath, {
            resource_type: "video" 
        });
        console.log(`SUCCESS! Received Secure URL: ${result.secure_url}`);
        uploadMap[originalRef] = result.secure_url;
    } catch(err) {
        console.error(`FAILED to upload ${originalRef}:`, err.message);
    }
  }

  console.log("\n[Julsona Automater] ----------------------------------------------");
  console.log("Finished heavy uploading. Instantly converting HTML code to live URLs...");

  // Safely replace local references in all HTML and JS files
  let replacedCount = 0;
  for(const file of targetFiles) {
      let content = fs.readFileSync(file, 'utf8');
      let changed = false;
      Object.keys(uploadMap).forEach(origPath => {
          const secureUrl = uploadMap[origPath];
          
          if (content.includes(`"${origPath}"`) || content.includes(`'${origPath}'`)) {
              content = content.split(`"${origPath}"`).join(`"${secureUrl}"`);
              content = content.split(`'${origPath}'`).join(`"${secureUrl}"`);
              changed = true;
          }
      });
      
      if(changed) {
          fs.writeFileSync(file, content, 'utf8');
          replacedCount++;
          console.log(`Successfully rewrote code inside: ${file}`);
      }
  }
  
  console.log(`\nAutomation Complete! Rewrote ${replacedCount} Code Files to route videos to Cloudinary!`);
}

uploadAndReplace().catch(console.error);
