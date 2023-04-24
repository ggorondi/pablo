
const dotenv = require("dotenv").config();
const qrcode = require('qrcode-terminal');
const fs = require('fs');// https://nodejs.org/api/fs.html
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');// https://docs.wwebjs.dev/Chat.html 
const {Configuration, OpenAIApi} = require("openai");// https://platform.openai.com/docs/api-reference/introduction
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const { exec } = require('child_process');
const { rejects } = require('assert');
const async = require('async');
const schedule = require('node-schedule'); //para schedule cosas a futuro.
const moment = require('moment');

/* ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ */

const configuration = new Configuration({
    apiKey : process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/**
 * Crea el cliente de whatsapp (crea el bot)
 */
const client = new Client({
    authStrategy: new LocalAuth(),
});

/**
 * funcion que genera el qr para escanaear con el celular. El celular que se usa va a ser el BOT
*/
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

/**
 * funcion que se ejecuta cuando el cliente se conecta a whatsapp (Cuando el bot se prende)
*/
client.on('ready', () => {
    console.log('Client is ready!');
});

//----------------------------------------------------------------------------------------------------------------------------------


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
        const filePath = path.join(__dirname, "out.mp3");
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

//----------------------------------------------------------------------------------------------------------------------------------
async function runCompletion(message, speciality){
    try{
        const prompting = speciality + message;
        const completion = await openai.createCompletion({
            engine: "text-davinci-003",
            prompt: prompting,
            maxTokens: 100,
            temperature: 0.9
        });
        return completion.data.choices[0].text;
    }
    catch(err){
        console.log(err);
        console.log('falla el runCompletion')
        console.log(process.env.OPENAI_API_KEY)
    }
}
/**
 * Funcion que envia el mensaje a la api de open ai, y luego recibe el mensaje de chatGPT 
 * @param {string} message mensaje que se envia a la api de open ai
 * @param {string} speciality que tipo de persona es el ai (asistente, ruso drogado, etc)
 * @returns el mensaje de chatGPT.
 */
async function runCompletion2(message, speciality){
    try {
        // send question to open ai
        const messages = [
            {
                role: "assistant",
                content: speciality
            },
            {
                role: "user",
                content: message   
            }
        ]
        const data = {
            model: "gpt-3.5-turbo",
            messages,
        }
        let res = await fetch("https://api.openai.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify(data)
            })

        res = await res.json()
        if(res.error){
            console.error(res)
        }
        return res.choices[0].message.content.trim();
        

    } catch (error) {
        console.log(`ERR: ${error}`);
        console.log('falla el runcompletion2')
    }
    
}

//funcion que crea objeto MySearchOptions que se pasan a fetchMessages()
function MySearchOptions(limit, fromMe) {
    this.limit = limit;
    this.fromMe = fromMe;
}

/**
 * Manda un mensaje privado a un contacto con el id contactID
 * @param {number} contactID 
 * @param {msg} message 
 */
async function sendPrivateMessage(contactID, message) {
    try {
      const chat = await client.getChatById(contactID);
      await chat.sendMessage(message);
    } catch (error) {
      console.error(error);
    }
}
/**
 * Devuelve una conversacion entera con los ultimos amount mensajes de un chat 
 * @param {number} amount 
 * @param {chat} fromChat 
 * @returns 
 */
async function getMessageLog( amount, fromChat){
    try{
        const mensajes = await fetchAmount(amount, fromChat);
        let linea = new Array(amount);
        var contacto;
        var nombre;
        var texto;
        var messageBeingResponded;
        var contactBeingResponded;
        var nameBeingResponded;
        for (let i = 0; i < mensajes.length; i++) {
            contacto=await mensajes[i].getContact();
            nombre=contacto.name;
            texto=mensajes[i].body;
            if(mensajes[i].hasQuotedMsg){ // para ver si esta respondiendo a un mensaje (se podrian hacer cosas interesantes con esto con los ids de los mensajes asi hay referencia a cual mensaje se responde) 
                messageBeingResponded = await mensajes[i].getQuotedMessage();
                contactBeingResponded = await messageBeingResponded.getContact(); 
                nameBeingResponded = contactBeingResponded.name;
                linea[i] = "[" + nombre + "]" +" respondiendo a " + "[" + nameBeingResponded + "]" + ": " + texto ;
            }
            else{
                linea[i] = "[" + nombre + "]"  + ": " + texto ;
            } 
        }
        //const concatMessages = mensajes.map(mensaje =>  mensaje.author + ": " +mensaje.body).join('\n');
        return linea.join("\n");
    }
    catch(err){
        console.log('getMessageLog Error: ' + err.message);
    }
}
/**
 * Devuelve un array de objetos message de un chat hasta amount times
 * @param {number} amount 
 * @param {chat} fromChat 
 * @returns 
 */
//busca cierto amount de messages de ese chat
async function fetchAmount( amount, fromChat){
    let plusOne = amount;
    plusOne++; //suma un mensaje para despues sacar el ultimo
    try{
        const options = new MySearchOptions(plusOne, undefined);
        console.log(amount + " " + fromChat.name);
        const mensajes = await fromChat.fetchMessages(options);
        mensajes.splice(-1); //saca el ultimo mensaje (el que pidio el fetch o lo que sea)
        return mensajes; // devuelve un conjunto de objetos message
    }
    catch(err){
        console.log('fetch error: ' + err);
    }
    
}
/**
 * Devuelve el chat con el nombre chatName  
 * @param {string} chatName 
 * @returns 
 */
async function getChatByName(chatName) {
    const chats = await client.getChats();
    for (const chat of chats) {
        if (chat.name === chatName) {
            return chat;
        }
    }
}

const queue = async.queue(async (msg, callback) => {
    const transcript = await getTranscript(msg);
    if(transcript !== ""){
        const msgLower = msg.body.toLowerCase();
        switch(msgLower){
            case "texto":
                msg.react('👍');
                msg.reply(transcript);
                break;
        case "audiogpt":
            msg.react('👍');
            runCompletion2(transcript, "Sos un asistente que responde con simpleza y es muy inteligente").then(result => msg.reply(result));      
            break;
        }
    }

    // invoke the callback function to signal the completion of the task
    callback();
  }, 1);

/**
 * Devuelve el primer string de un mensaje.body
 * @param {string} str 
 * @returns 
 */

function getFirstWord(str) {
    const words = str.split(" ");
    const firstWord = words[0];
    const restOfStr = words.slice(1).join(" ");
    return [firstWord, restOfStr];
}

/**
 * Crea resumen de chat donde fue mandado msg
 * @param {msg} msg 
 */
async function createSummaryWrapper(msg){
    const chat = await msg.getChat();
    await createSummary(200, msg,chat);
}
/**
 * Crea resumen de chat de fromChat
 * @param {msg} msg 
 * @param {chat} fromChat 
 */
async function createSummary(amount, msg, fromChat){
    const sender = await msg.getContact();
    const senderId = sender.id._serialized;
    console.log(amount);
    const chatLog = await getMessageLog(amount, fromChat);
    const gptPreambulo = 'Quiero que resumas la conversación que pongo a continuación manteniendo quien dijo que y que no se repitan las frases, mantenelo bien corto, menos de 100 palabras. Salteate detalles irrelevantes. También conta la cantidad de veces que cada persona mandó mensajes por el nombre que aparece asi "[nombre]", Y en un pequeño parrafo aparte escribí la cantidad de mensajes que mandó cada uno y el humor promedio de sus mensajes con este formato: [nombre] - numero de mensajes {humor}:\n';
    runCompletion2(gptPreambulo + chatLog, "Sos un asistente que resume conversaciones.").then(result => sendPrivateMessage(senderId, result));      

}
/**
 * le pide a chatgpt que analice y devuelva el datetime apropiado para el reminder
 * @param {Date} currentDate
 * @param {string} requestString 
 * @param {msg} msg
 */
async function getReminderDatetime(currentDate, requestString, msg){
    const sender = await msg.getContact();
    const senderId = sender.id._serialized;
    const gptPreambulo = 'You are a program that helps with creating a new datetime based on a specific request. The current datetime is exactly: "'+currentDate.toString()+'. Your response should be a new datetime, written in the same format, but based on this request for modification that is in spanish: "'+requestString+'". Assume the same year or month or day or hour or timezone if they are not explicitly specified in the modification. Respond with ONLY the datetime, in the same english format as the current time. Dont add any more text than the datetime.\n';
    var newDate = await runCompletion2(gptPreambulo, "You are a simple computer program");    
    console.log(currentDate.toString())  
    console.log(newDate.toString());
    try {
        newDate = checkDateString(newDate);
        return newDate;
    }
    catch (err) {
        console.log("getReminderDateTime error: "+err)
        throw err;
    }
}

function checkDateString(dateString) {
    const dateFormat = /^([a-z]{3}) ([a-z]{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT([+-]\d{4}) \(([\w\s]+)\)$/i; //tiene que estar en este formato que es el Date.toString() format, los // delimitan el regex, el i señala case insensitive, ^ fija que este en el start, $ el final.
    if (dateFormat.test(dateString)) {
      return dateString;
    } else {
      throw new Error("Invalid date string format.");
    }
  }

function apodoRandom(){ // (no inclusivo)
    const strings = ['capitan atlantico', 'ministro de seguridad', 'arquitecto de ilusiones', 'capo', 'bestia', 'pedazo de sexy', 'corazon de melocoton', 'domador de gusanos', 'patron', 'jefe', 'batiman', 'lindo UwU'];
    const randomIndex = Math.floor(Math.random() * strings.length);
    return strings[randomIndex];
}

async function createImage(prompto){
    const prompt = prompto + " "; 
    const result = await openai.createImage({
        prompt, 
        n: 1,
        size: '256x256'

    });
    const url = result.data.data[0].url;
    console.log(url);
    const img = await fetch(url);
    const blob = await img.blob();
    const buffer  = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync('image.png', buffer);
}

function deleteFile(fileToDelete){
    fs.unlink(fileToDelete, (err) => {
        if (err) {
          console.error(err)
          return
        }
      })
}

/**
 * Decide que hacer con el mensaje
 * @param {msg} msg 
 */
async function handleMessage(msg){
    const [firstWord, restOfStr] = getFirstWord(msg.body);

    if(restOfStr){ // si tiene otro parametro ademas de la primera  palabra
        switch (firstWord.toLowerCase()) {
            case 'img':
                msg.react('👍');
                await createImage(restOfStr);
                
                const imgMedia = MessageMedia.fromFilePath('image.png');
                msg.reply(imgMedia);
                deleteFile('image.png');

                break;
            case 'summame':
                const fromChat = await getChatByName(restOfStr);
                if(fromChat){
                    msg.react('👍');
                    createSummary(200, msg, fromChat);
                }
                else{
                    msg.reply("Invalid input chat name, must be called this way: resumi [chatName]");
                }
                break;
            case 'gpt':
                msg.react('👍');
                runCompletion2(restOfStr, "Sos un asistente que responde con simpleza y es muy inteligente").then(result => msg.reply(result));
                break;
            case 'log':
                const chat = await msg.getChat();
                const cantidad = Number(restOfStr);
                if (isNaN(cantidad)) {
                    msg.reply("Invalid input number, must be called this way: log [number]");
                } else {
                    msg.react('👍');
                    const reply = await getMessageLog(cantidad, chat);
                    msg.reply("MessLog: " + reply);
                }
                break;
            case 'summa':
                const currChat = await msg.getChat();
                const cantidadMsgs=Number(restOfStr);
                if (isNaN(cantidadMsgs)) {
                    msg.reply("Invalid input number, must be called this way: summa [number]");
                } else {
                    msg.react('👍');
                    await createSummary(cantidadMsgs, msg, currChat);
                }
                break;
            case 'atou':
                let ars = Number(restOfStr);
                if (isNaN(ars)) {
                    msg.reply("Invalid input number, must be called this way: atou [number]");
                } else {
                    msg.react('👍');
                    let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
                    let compra = parseFloat(dolares.data[1].compra);
                    let venta = parseFloat(dolares.data[1].venta);
                    let dolarblue = (compra + venta) / 2;
                    let arsToUsd = ars / dolarblue;
                    arsToUsd = parseFloat(arsToUsd.toFixed(2));
                    msg.reply("ARS to USD: U$D" + arsToUsd);
                }
                break;
            case 'utoa':
                let usd = Number(restOfStr);
                if (isNaN(usd)) {
                    msg.reply("Invalid input number, must be called this way: utoa [number]");
                } else {
                    msg.react('👍');
                    let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
                    let compra = parseFloat(dolares.data[1].compra);
                    let venta = parseFloat(dolares.data[1].venta);
                    let dolarblue = (compra + venta) / 2;
                    let usdToArs = usd * dolarblue;
                    usdToArs = parseFloat(usdToArs.toFixed(2));
                    msg.reply("USD to ARS: AR$" + usdToArs);
                }
                break;
            case 'reminder':
                let currDate = new Date();
                try{
                    let reminderDate = await getReminderDatetime(currDate, restOfStr, msg);
                    schedule.scheduleJob(reminderDate, () => {
                        msg.reply("aca esta tu recordatorio "+apodoRandom())
                        msg.react('🫡');
                        });
                    msg.react('⏰');
                }
                catch(err){
                    console.log('schedule reminder error: '+err);
                    msg.react('☠️');
                }
                break;
            default:
                break;
        }
    }
    else{ // si es un comando de solo una palabra
        switch (msg.body.toLowerCase()) {
            case 'summa':
                msg.react('👍');
                await createSummaryWrapper(msg);
                break;
            case 'texto':
                if(msg.hasQuotedMsg){
                    queue.push(msg);
                }
                break;
            case 'randomize':
                let response = await axios.get('https://www.boredapi.com/api/activity');
                let act = response.data;
                msg.reply(act.activity);
                break;
            case 'dolares':
                let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
                let dolaresData = dolares.data;
                let dolaresStr = "*CASA* : COMPRA | VENTA\n";
                dolaresStr += "_____________________________________\n";
                var date = moment(dolaresData[0].fechaActualizacion).utc().format('DD/MM/YYYY');
                for (let i = 0; i < dolaresData.length; i++) {
                    const dolar = dolaresData[i];
                    dolaresStr += `*${dolar.nombre}* : ${dolar.compra} | ${dolar.venta}\n`;
                    dolaresStr += "_____________________________________\n";
                }
                dolaresStr += `${date} \n`;
                dolaresStr += "_Fuente: https://dolarhoy.com/_";
                msg.reply(dolaresStr);
                break;
            case 'dolar':
                
                let dolar = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
                let dolarData = dolar.data[1];
                msg.reply(`
                *${dolarData.nombre}*
_____________________________________            
Compra: *${dolarData.compra}*         
_____________________________________            
Venta: *${dolarData.venta}*       
_____________________________________            
_Fuente: https://dolarhoy.com/_
            `);
                break;
            case '!groupinfo':
                let chat = await msg.getChat();
                if (chat.isGroup) {
                    msg.reply(`
                        *Group Details*
Name: ${chat.name}
Description: ${chat.description}
Created At: ${chat.createdAt.toString()}
Created By: ${chat.owner.user}
Participant count: ${chat.participants.length}
                    `);
                } else {
                    msg.reply('This command can only be used in a group!');
                }
                break;
            case '!help':
                help(msg);
                break;
            default:
                break;
        }
    }
    
}

function help(msg){
    msg.reply(`
                    *Comandos*
_____________________________________            
*summa*: resume 200 msg's del chat         
_____________________________________            
*summa [n]*: resume n msg's del chat       
_____________________________________            
*resumi [chat]*: resume msg's de chat       
_____________________________________            
*gpt [consulta]*: responde gpt     
_____________________________________            
*texto*: traduce audio a texto     
_____________________________________            
*gptaudio*: audio a gpt            
_____________________________________
*randomize*: random activity
_____________________________________
*log [n]*: muestra n msg's         
_____________________________________            
*atou [number]*: ARS to USD
_____________________________________
*utoa [number]*: USD to ARS
_____________________________________
*dolares*: dolar info
_____________________________________
*dolarB*: dolar blue info
_____________________________________
*dolaroficial*: dolar oficial info
_____________________________________
*!groupinfo*: info del grupo
_____________________________________
*!help*: muestra este mensaje
_____________________________________
                `);
}
/**
 * imprime en consola para que sea mas facil de leer
 * @param {msg} msg 
 */
async function printFormattedMsg(msg){
    const contact = await msg.getContact();
    const chat  = await msg.getChat();
    const msgTo = chat.name;
    const contactPushName = contact.pushname;
    const contactNumber = contact.number;
    console.log('\x1b[90m{'+ `\x1b[31m[${contactNumber} : \x1b[34m${contactPushName}\x1b[31m]`+ `\x1b[90m --to-->` + ` \x1b[36m${msgTo}\x1b[31m `+`\x1b[90m:`+` \x1b[32m${msg.body}\x1b[31m`+'\x1b[90m}');

}
client.on('message_create', async msg => {
    if(msg.fromMe) {
        printFormattedMsg(msg);
        handleMessage(msg);
    }
});

client.on('message' , async msg => {
    printFormattedMsg(msg);
    handleMessage(msg); 
});


client.initialize();

/**
 * TODO: 
 * * chatGPT literalmente en un grupo privado (con todos los textos )
 * * presets de conversadores de gpt
 * * comando help
 * * ver como implementar reminders, o exportar reminders a google calendar
 * * 
 */