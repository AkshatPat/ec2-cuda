import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const inputPath = './video.insv';
const mp4Path = './output.mp4';
const frameDir = './frames';

if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir);

// STEP 1: Try convert insv → mp4 using ffmpeg
function convertToMp4(input, output) {
  return new Promise((resolve, reject) => {
    exec(`ffmpeg -y -i "${input}" -c copy "${output}"`, (error, stdout, stderr) => {
      if (error) {
        console.log('Conversion failed:', stderr);
        reject(error);
      } else {
        console.log('Conversion complete');
        resolve();
      }
    });
  });
}

// STEP 2: Extract frames from mp4
function extractFrames(videoPath, outDir) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(path.join(outDir, 'frame-%04d.jpg'))
      .outputOptions([
        '-vf', 'fps=4',
        '-qscale:v', '2'
      ])
      .on('end', () => {
        console.log('10 FPS frames extracted');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error extracting frames:', err);
        reject(err);
      })
      .run();
  });
}

function runColmapCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Error running: ${command}`);
        console.error(stderr);
        return reject(err);
      }
      console.log(`✅ ${command} executed`);
      resolve(stdout);
    });
  });
}


// RUN THE PIPELINE
(async () => {
  try {
    await convertToMp4(inputPath, mp4Path);
    await extractFrames(mp4Path, frameDir);
    console.log('✅ Done');
  } catch (err) {
    console.error('❌ Pipeline failed:', err.message);
  }
})();
