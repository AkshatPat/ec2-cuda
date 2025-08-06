import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

const inputPath = './video.insv';
const mp4Path = './output.mp4';
const frameDir = './frames';
const colmapDir = './colmap';
const databasePath = path.join(colmapDir, 'database.db');
const imagePath = path.resolve(frameDir);
const sparseDir = path.join(colmapDir, 'sparse');
const plyOutputDir = path.join(colmapDir, 'model.ply');

// Create required folders
if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir);
if (!fs.existsSync(colmapDir)) fs.mkdirSync(colmapDir);
if (!fs.existsSync(sparseDir)) fs.mkdirSync(sparseDir);

// STEP 1: Convert .insv → .mp4
function convertToMp4(input, output) {
  return new Promise((resolve, reject) => {
    exec(`ffmpeg -y -i "${input}" -c copy "${output}"`, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Conversion failed:', stderr);
        reject(error);
      } else {
        console.log('✅ Conversion complete');
        resolve();
      }
    });
  });
}

// STEP 2: Extract frames at 10 FPS
function extractFrames(videoPath, outDir) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(path.join(outDir, 'frame-%04d.jpg')) // → frame-0001.jpg, frame-0002.jpg, etc.
      .outputOptions(['-vf', 'fps=2', '-qscale:v', '2'])
      .on('end', () => {
        console.log('✅ 4 FPS frames extracted');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Error extracting frames:', err);
        reject(err);
      })
      .run();
  });
}

// STEP 3: Run COLMAP feature extractor
async function runColmapPipeline_1() {
  console.log('🚀 Running COLMAP pipeline...');
  
  console.log("1 running");
  
  // 3.1 Feature Extraction
  await execPromise(`colmap feature_extractor --database_path "${databasePath}" --image_path "${imagePath}"`);

  console.log("2 running");
  // 3.2 Exhaustive Matching (or you can use sequential matcher)
  await execPromise(`colmap sequential_matcher --database_path "${databasePath}"`);

  console.log("3 running");
  // 3.3 Mapping (Sparse reconstruction)
  await execPromise(`colmap mapper --database_path "${databasePath}" --image_path "${imagePath}" --output_path "${sparseDir}"`);

  console.log("4 running");
  // 3.4 Convert model to .ply
  await execPromise(`colmap model_converter --input_path "${sparseDir}/0" --output_path "${plyOutputDir}" --output_type PLY`);

  console.log('✅ COLMAP reconstruction complete → model.ply created');
}

async function runColmapPipeline() {

   console.log('🚀 Running COLMAP pipeline...');
 
  // Step 1: Feature Extraction
  console.log("step- 1 Running Feature Extraction");
  
   await execPromise(`colmap feature_extractor --database_path "${databasePath}" --image_path "${imagePath}"`);
 
  // Step 2: Matching
   console.log("step- 2 Running Feature Matching");
   await execPromise(`colmap sequential_matcher --database_path "${databasePath}"`);
   
   // Step 3: Sparse Reconstruction (Mapping)
   console.log("step- 3 Running Sparse Reconstruction (Mapping)");
   
   await execPromise(`colmap mapper --database_path "${databasePath}" --image_path "${imagePath}" --output_path "${sparseDir}"`);
   
   // Step 4: Image Undistortion (Required for dense)
   console.log("step- 4 Running Image Undistortion (Required for dense)");
   
   const denseDir = path.join(colmapDir, 'dense');
   
   if (!fs.existsSync(denseDir)) fs.mkdirSync(denseDir);
   
   await execPromise(`colmap image_undistorter --image_path "${imagePath}" --input_path "${sparseDir}/0" --output_path "${denseDir}" --output_type COLMAP`);
   
   // Step 5: Dense Stereo
   console.log("step- 5 Running Dense Stereo");
   
   await execPromise(`colmap patch_match_stereo --workspace_path "${denseDir}" --workspace_format COLMAP --PatchMatchStereo.geom_consistency true`);
   
   // Step 6: Dense Fusion → creates a dense point cloud
   console.log("step- 6 Running Dense Fusion → creates a dense point cloud");

   await execPromise(`colmap stereo_fusion --workspace_path "${denseDir}" --workspace_format COLMAP --input_type geometric --output_path "${plyOutputDir}"`);
 
  console.log('✅ Dense reconstruction complete → model.ply created');

 }

// RUN ENTIRE PIPELINE
(async () => {
  try {
    // await convertToMp4(inputPath, mp4Path);
    // await extractFrames(mp4Path, frameDir);
    await runColmapPipeline();
    console.log('🎉 Done: PLY model generated');
  } catch (err) {
    console.error('❌ Pipeline failed:', err.message);
  }
})();
