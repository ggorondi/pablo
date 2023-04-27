const fs = require('fs');// https://nodejs.org/api/fs.html
const { exec } = require('child_process');
const FormData = require('form-data');
const path = require('path');
const axios = require('axios');


/**
 * Busca el mensaje que contiene el audio y lo descarga (This function handles the
 * missing media in the chat by retrieving messages from the chat until the media is available)
 * @param {qmsg} quotedMsg 
 * @param {int} messageId 
 * @param {chat} chat 
 * @param {int} maxRetries 
 * @returns 
 */
async function downloadQuotedMedia(quotedMsg, messageId, chat, maxRetries = 5) {
	let attachmentData = null;
	let counter = 10;
  
	while (!attachmentData && counter <= maxRetries) {
	  try {
		const quotedMsgArr = await chat.fetchMessages({ limit: counter });
		for (let i = 0; i < quotedMsgArr.length; i++) {
		  if (quotedMsgArr[i].id._serialized === messageId) {
			attachmentData = await quotedMsg.downloadMedia();
			break;
		  }
		}
	  } catch (err) {
		console.log(`Error fetching messages. Retrying in 5 seconds... (attempt ${counter}/${maxRetries})`);
		await new Promise(resolve => setTimeout(resolve, 5000));
	  }
      
	  counter++;
	}
	if (!attachmentData) {
	  console.log(`Could not download quoted media after ${maxRetries} attempts.`);
	}
  
	return attachmentData;

}
/**
 * Crear los archivos de audio y de texto
 * @param {string} base64String 
 */
async function createFiles(base64String){
    const binaryString = Buffer.from(base64String, 'base64').toString('binary');
    const pcmData = Buffer.from(binaryString, 'binary');
    const inputFile = 'in.ogg';
    const outputFile = 'out.mp3';

    await new Promise((resolve, reject) => {
        fs.writeFile(inputFile, pcmData, (err) => {
            if (err) reject(err);
            console.log('The OGG file has been saved!');
            resolve();
        });
    });

    const command = `ffmpeg -i ${inputFile} ${outputFile}`;

    // Execute FFmpeg command
    await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`Error during conversion: ${error.message}`);
                reject(error);
                return;
            }
            console.log('Conversion complete');
            resolve();
        });
    });

    
}
/**
 * Transcribe el audio a texto y lo devuelve
 * @param {msg} msg 
 * @returns 
 */
async function SpeechToTextTranscript(msg) {
    try {
        msg.react('☠️');
        const filePath = path.join(__dirname, "../out.mp3");
        const model = 'whisper-1';

        const formData = new FormData();
        formData.append("model", model);
        formData.append("file", fs.createReadStream(filePath));
        console.log("Calling Whisper");
        
        const transcription = await new Promise(async (resolve, reject) => {
            try {
                const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData,{
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        "Content-Type": `multipart/form-data; boundry=${formData._boundary}`,
                    }
                });
                const text = response.data.text;
                msg.react('🥳');
                deleteFiles();
                console.log(text);
                resolve(text);
            } catch (err) {
                console.log("No tiene archivo");
                reject(err);
            }
        });
        
        return transcription;
    } catch (err) {
        deleteFiles();
        console.error(err);
    }
}

/**
 * Se encarga de recibir el mensaje quoted, despues hace chequeos de si es un audio, 
 * se manda a descargar el audio, crea los archivos de audio, hace el transcript y lo devuelve
 * @param {msg} message 
 * @returns 
 */
async function getTranscript(message){

    const chat = await message.getChat();
    var ans = ""; // aca voy a guardar la respuesta de la api
    // Here we check if the message has a quoted message
    const quotedMsg = await message.getQuotedMessage();
    const messageId = quotedMsg.id._serialized	

    // Here we check if the message has media
    if (quotedMsg.hasMedia) {
        // If is a voice message, we download it and send it to the api
        if (quotedMsg.type.includes("ptt") || quotedMsg.type.includes("audio")) {
            
            const maxRetries = 1000;
            message.react("😎");
            const attachmentData = await downloadQuotedMedia(quotedMsg, messageId, chat, maxRetries);
            message.react("😱");
            if (attachmentData) {
                await createFiles(attachmentData.data);
                const transcriptionPromise = SpeechToTextTranscript(message);
                ans = await transcriptionPromise;
            } else {
                message.reply("The file couldn't be fetched");
            }
            
        }
    }
    console.log("ans: " + ans);
    return ans;
}
/**
 * Borra los archivos de audio 
 */
function deleteFiles(){
    try{
        const file1 = 'in.ogg';

        const file2 = 'out.mp3';

        // delete the first file
        fs.unlink(file1, (err) => {
            if (err) throw err;
            console.log('File 1 deleted successfully');
        });

        fs.unlink(file2, (err) => {
            if (err) throw err;
            console.log('File 2 deleted successfully');
        });
    }
    catch(err){
        console.log("No se pudo borrar los archivos");
    }
}


module.exports = {
    getTranscript,
    SpeechToTextTranscript,
    createFiles,
    downloadQuotedMedia,
    deleteFiles
};