const imageModule = require('./src/image');
const soundModule = require('./src/sound');
const textModule = require('./src/text');
const miscModule = require('./src/misc');

const dotenv = require("dotenv").config();
const qrcode = require('qrcode-terminal');

const { Client, LocalAuth,  Location, List, Buttons } = require('whatsapp-web.js');// https://docs.wwebjs.dev/Chat.html 
const {Configuration, OpenAIApi} = require("openai");// https://platform.openai.com/docs/api-reference/introduction
const async = require('async');
const schedule = require('node-schedule'); //para schedule cosas a futuro.

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


const queue = async.queue(async (msg, callback) => {
    const transcript = await soundModule.getTranscript(msg);
    if(transcript){
        const msgLower = msg.body.toLowerCase();
        switch(msgLower){
            case "texto":
                msg.react('👍');
                msg.reply(transcript);
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


function separateNumberAndString(str) {
    const regex = /^(\d+)\s*(.*)/; // regular expression to match the first number and the rest of the string
    const matches = str.match(regex); // match the regular expression against the input string
    if (matches) {
      const num = parseInt(matches[1]); // convert the matched number string to an integer
      const restOfString = matches[2].trim(); // get the rest of the string and remove any leading/trailing whitespace
      return [num, restOfString]; // return the separated values as an array
    } else {
      return [null, str]; // return null if no number is found
    }
  }
  

/**
 * Decide que hacer con el mensaje
 * @param {msg} msg 
 */
async function handleMessage(msg){
    const chat = await msg.getChat();
    //check si no es un msj de forbidden chat
    if(!msg.fromMe) {
        if(miscModule.isForbiddenChat(chat.name)) {return;}
    }
    
    
    const [firstWord, restOfStr] = getFirstWord(msg.body);
    
    
    if(restOfStr){ // si tiene otro parametro ademas de la primera  palabra
        switch (firstWord.toLowerCase()) {
            case 'imghug': // FUNCIONA
                try{
                    msg.react('👍');
                    const imgMedia = await imageModule.textToImageHugging({"inputs": `${restOfStr}`}); // crea imagen en image.png
                    msg.reply(imgMedia);
                }
                catch( err){
                    console.log(err);
                }
                break;
            case 'imgope': // FUNCIONA
                try{
                    msg.react('👍');
                    const imgMedia = await imageModule.textToImageOpenAI(restOfStr); // crea imagen en image.png
                    msg.reply(imgMedia);
                }
                catch( err){
                    console.log(err);
                }
                break;
            case 'resumime': // FUNCIONA 
                console.log("HOLAaaaaaaaa");
                separateNumberAndString(restOfStr);
                let amount;
                let chatName = separateNumberAndString(restOfStr)[1];
                if(separateNumberAndString(restOfStr)[0] === null){
                    amount  = 30;
                }
                else{
                    amount = separateNumberAndString(restOfStr)[0];
                    if(amount < 1 || amount > 1000){
                        msg.reply("Invalid input amount, must be between 1 and 1000");
                        return;
                    }
                }
                const clientChats = await client.getChats();
                const fromChat = await textModule.getChatByName(clientChats, chatName);
                if(fromChat){
                    const sender = await msg.getContact();
                    const senderID = sender.id._serialized;
                    let result = await textModule.createSummary(amount, msg, fromChat);
                    msg.react('👍');
                    msg.reply(result);
                    //const toChat = await client.getChatById(senderID);
                    //toChat.sendMessage(result);
                }
                else{
                    msg.reply("Invalid input chat name, must be called this way: resumime [chatName]");
                }
                break;
            
            case 'gpt': // FUNCIONA
                msg.react('👍');
                textModule.runCompletion(restOfStr, "Sos un asistente que responde con simpleza y es muy inteligente").then(result => msg.reply(result));
                break;
            case '!log': // FUNCIONA
                const chat = await msg.getChat();
                const cantidad = Number(restOfStr);
                if (isNaN(cantidad) || cantidad < 1 || cantidad > 1000) {
                    msg.reply("Invalid input number, must be called this way: !log [number] and the number of messages must be between 1 and 1000");
                } else {
                    msg.react('👍');
                    const [reply, tokenCount] = await textModule.getMessageLog(cantidad, chat);
                    msg.reply(reply);
                }
                break;
            case 'summa':
                const currChat = await msg.getChat();
                const cantidadMsgs= Number(restOfStr);
                if (isNaN(cantidadMsgs)|| cantidadMsgs < 1 || cantidadMsgs > 500) {
                    msg.reply("Invalid input number, must be called this way: summa [number] and the number of messages must be between 1 and 500");
                } else {
                    msg.react('👍');
                    let result = await textModule.createSummary(cantidadMsgs, msg, currChat);
                    msg.reply(result);
                }
                break;
            case 'atou':// FUNCIONA
                let ars = Number(restOfStr);
                if (isNaN(ars)) {
                    msg.reply("Invalid input number, must be called this way: atou [number]");
                } else {
                    msg.react('👍');
                    const arsToUsd = await miscModule.getAtoU(ars);
                    msg.reply("ARS to USD: U$D" + arsToUsd);
                }
                break;
            case 'utoa': // FUNCIONA
                let usd = Number(restOfStr);
                if (isNaN(usd)) {
                    msg.reply("Invalid input number, must be called this way: utoa [number]");
                } else {
                    msg.react('👍');
                    const usdToArs = await miscModule.getUtoA(usd);
                    msg.reply("USD to ARS: AR$" + usdToArs);
                }
                break;
            case 'reminder':// FUNCIONA
                let currDate = new Date();
                try{
                    let reminderDate = await textModule.getReminderDatetime(currDate, restOfStr, msg);
                    //const options = { day: '2-digit', month: 'short', year: 'numeric' };
                    //const spanishDate = reminderDate.toLocaleDateString('es-ES', options); //no funciona
                    var nowTime = new Date().getTime()
                    if (reminderDate.getTime() <= nowTime) {
                        msg.react('☠️');
                        msg.reply("Especificá mejor cuando lo queres por favor!");
                        break;
                    }
                    msg.reply("Recordatorio creado para: "+ reminderDate);
                    schedule.scheduleJob(reminderDate, () => {
                        msg.reply("aca esta tu recordatorio "+ textModule.apodoRandom())
                        msg.react('🫡');
                        });
                    msg.react('⏰');
                }
                catch(err){
                    console.log('schedule reminder error: '+err);
                    msg.reply("Especificá mejor cuando lo queres por favor!");
                    msg.react('☠️');
                }
                break;
            case '!prohibir': // FUNCIONA
                let chatAProhibir = restOfStr;
                miscModule.pushToForbiddenChats(chatAProhibir);
                break;
            case '!desprohibir': // FUNCIONA
                let chatAHabilitar = restOfStr;
                miscModule.popFromForbiddenChats(chatAHabilitar);
                break;
            default:
                break;
        }
    }
    else{ // si es un comando de solo una palabra
        switch (msg.body.toLowerCase()) {
            case 'prueba':
                msg.reply("hola");
                break;
            case 'variation':
                if(msg.hasQuotedMsg){
                    const quotedMsg = await msg.getQuotedMessage();
                    msg.react('👍');
                    let imgMedia = await imageModule.createVariationOpenAI(quotedMsg);
                    if(imgMedia){
                        msg.reply(imgMedia);
                        //msg.reply( response[0].score + " : "+response[0].label);
                    }
                    else {
                        msg.react('☠️');
                        msg.reply("wtf esto no es una foto");
                    }
                }
                break;
            case 'convert': 
                if(msg.hasQuotedMsg){
                    msg.react('👍');
                    const quotedMsg = await msg.getQuotedMessage();
                    let response = await imageModule.imageToPromptReplicate(quotedMsg);
                    console.log(response);
                    if(response){
                        msg.reply(response);
                        //msg.reply( response[0].score + " : "+response[0].label);
                    }
                    else {
                        msg.reply("wtf esto no es una foto");
                    }
                }
                break;
            case 'sticker':
                if(msg.hasQuotedMsg){
                    msg.react('👍');
                    const quotedMsg = await msg.getQuotedMessage();
                    let stickerMedia = await imageModule.imageToSticker(quotedMsg);
                    if(stickerMedia){
                        client.sendMessage(msg.from, stickerMedia, { sendMediaAsSticker: true}); 
                    }
                    else {
                        msg.reply("wtf esto no es una foto?");
                    }
                }
                else {
                    msg.reply("wtf esto no es una foto?");
                }
                break;
            case 'yolo':
                if(msg.hasQuotedMsg){
                    msg.react('👍');
                    const quotedMsg = await msg.getQuotedMessage();
                    let response = await imageModule.imageToPromptReplicate(quotedMsg);
                    console.log(response);
                    if(response){
                        msg.reply("imghug "+ response);
                        //msg.reply( response[0].score + " : "+response[0].label);
                    }
                    else {
                        msg.reply("wtf esto no es una foto");
                    }
                }
                break;
            case 'texto': // FUNCIONA
                if(msg.hasQuotedMsg){
                    queue.push(msg);
                }
                break;
            case 'summa':
                msg.react('👍');
                await textModule.createSummaryWrapper(msg);
                break;
            case 'randomize': // FUNCIONA
                let response = await miscModule.randomizeActivity();
                msg.reply(response);
                break;
            case 'dolares': // FUNCIONA
                const dolaresStr = await miscModule.dolares();
                msg.reply(dolaresStr);
                break;
            case 'dolar':// FUNCIONA
                const dolarStr = await miscModule.dolar();
                msg.reply(dolarStr);
                break;
            case '!prohibidos':
                const forbiddenChats = miscModule.getForbiddenChats();
                let str = "Chats prohibidos-> ";
                for (let i = 0; i < forbiddenChats.length; i++) {
                    str+="|"+forbiddenChats[i];
                }
                str+="|";
                msg.reply(str);
                break;
            case '!groupinfo': // FUNCIONA
                let chat = await msg.getChat();
                if (chat.isGroup) {
                    const groupInfoStr = miscModule.groupInfo(chat);
                    msg.reply(groupInfoStr);
                } else {
                    msg.reply('This command can only be used in a group!');
                }
                break;
            case '!help': // FUNCIONA
                const helpMsg =  miscModule.help();
                msg.reply(helpMsg);
                break;
            default:
                break;
        }
    }
    
}

/**
 * imprime en consola para que sea mas facil de leer
 * @param {msg} msg 
 */
async function printFormattedMsg(msg){
    const contact = await msg.getContact();
    const chat  = await msg.getChat();
    const msgTo = await chat.name;
    const contactPushName = contact.pushname;
    const contactNumber = contact.number;
    
    const device = msg.deviceType;
    const timestamp = new Date().getTime();  
    const date = new Date(timestamp);

    const options = {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    };

    const readableHour = date.toLocaleTimeString('en-US', options);
    console.log(`${device} at ${readableHour}`+'\x1b[90m{'+ `\x1b[31m[${contactNumber} : \x1b[34m${contactPushName}\x1b[31m]`+ `\x1b[90m --to-->` + ` \x1b[36m${msgTo}\x1b[31m `+`\x1b[90m:`+` \x1b[32m${msg.body}\x1b[31m`+'\x1b[90m}');

}
client.on('message_create', async msg => {
    if(msg.fromMe) {
        //printFormattedMsg(msg);
        handleMessage(msg);
    }
});

client.on('message' , async msg => {
    //printFormattedMsg(msg);
    handleMessage(msg); 
});


client.initialize();

/**
 * TODO: 
 * * CHUNKS para el  SUMMA
 * * chatGPT literalmente en un grupo privado (con todos los textos )
 * * presets de conversadores de gpt
 * * ver como implementar reminders, o exportar reminders a google calendar
 * * 
 */