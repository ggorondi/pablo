const fs = require('fs');// https://nodejs.org/api/fs.html
const Replicate = require('replicate');
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

const { Buffer } = require('buffer');
const streamifier = require('streamifier');
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const { MessageMedia } = require('whatsapp-web.js');// https://docs.wwebjs.dev/Chat.html
const { spawn } = require('child_process');

async function convertOggToMp3Stream(oggBase64String) {
    const oggBuffer = Buffer.from(oggBase64String, 'base64');
    // Start FFmpeg process
    const ffmpeg = spawn('ffmpeg', [
        '-i', '-',     // read input from stdin
        '-f', 'mp3',   // output format
        '-'            // output to stdout
    ]);
    

    // Send input to FFmpeg
    ffmpeg.stdin.write(oggBuffer);
    ffmpeg.stdin.end();
    // Handle end of input
    ffmpeg.on('close', () => {
        ffmpeg.stdin.destroy();
    });
    // Return MP3 read stream
    return ffmpeg.stdout;
}

async function speechToTextTranscript(base64data) {
    try {
        const mp3stream = await convertOggToMp3Stream(base64data);
        const buffer = await streamToBuffer(mp3stream); // convert to buffer
        const stream = streamifier.createReadStream(buffer); // create readable stream from buffer
        const filePath = new Date().getTime() + '.mp3';
    
        // Pipe the stream to the file and wait for the write operation to complete
        await new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(filePath);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
            stream.pipe(fileStream);
        });
    
        const resp = await openai.createTranscription(
            fs.createReadStream(filePath),
            'whisper-1'
        );
        fs.unlinkSync(filePath);
        const text = resp.data.text;
        return text;
    } catch (err) {
        fs.unlinkSync(filePath);
        console.error(err);
        throw err;
    }
  }
  

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Se encarga de recibir el mensaje quoted, despues hace chequeos de si es un audio, 
 * se manda a descargar el audio, crea los archivos de audio, hace el transcript y lo devuelve
 * @param {msg} message 
 * @returns 
 */
async function getTranscript(message){

    const quotedMsg = await message.getQuotedMessage();

    // Here we check if the message has media
    if (quotedMsg.hasMedia) {
        if (quotedMsg.type.includes("ptt") || quotedMsg.type.includes("audio")) {
            message.react("😎");
            const attachmentData = await quotedMsg.downloadMedia();
            message.react("😱");
            if (attachmentData.data) {
                const transcription = await speechToTextTranscript(attachmentData.data);
                return transcription;
            } else {
                message.reply("The file couldn't be fetched");
            }
        }
    }
    return;
}

async function textToSoundReplicate(prompt){
    try{
        const model = "haoheliu/audio-ldm:b61392adecdd660326fc9cfc5398182437dbe5e97b5decfb36e1a36de68b5b95";
        const input = {
            text: prompt,
        };
        const url = await replicate.run(model, { input });
        console.log(url);
        const audioMedia = await MessageMedia.fromUrl(url);
        return audioMedia;
    }
    catch (err){
        console.log(err);
    }
}

module.exports = {
    getTranscript,
    textToSoundReplicate
};