const imageModule = require('./src/image');
const soundModule = require('./src/sound');
const textModule = require('./src/text');
const miscModule = require('./src/misc');

const dotenv = require("dotenv").config();
const qrcode = require('qrcode-terminal');

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');// https://docs.wwebjs.dev/Chat.html 
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
    if(transcript !== ""){
        const msgLower = msg.body.toLowerCase();
        switch(msgLower){
            case "texto":
                msg.react('👍');
                msg.reply(transcript);
                break;
        case "audiogpt":
            msg.react('👍');
            textModule.runCompletion(transcript, "Sos un asistente que responde con simpleza y es muy inteligente").then(result => msg.reply(result));      
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
 * Decide que hacer con el mensaje
 * @param {msg} msg 
 */
async function handleMessage(msg){
    const [firstWord, restOfStr] = getFirstWord(msg.body);
    const chat = await msg.getChat();
    if(chat.isGroup){
        return;
    }
    if(restOfStr){ // si tiene otro parametro ademas de la primera  palabra
        switch (firstWord.toLowerCase()) {
            case 'img':
                msg.react('👍');
                try{
                    await imageModule.createImageHugging({"inputs": `${restOfStr}`});
                    const imgMedia = MessageMedia.fromFilePath('image.png');
                    msg.reply(imgMedia);
                    imageModule.deleteFile('image.png');
                }
                catch( err){
                    console.log(err);
                }
                break;
            case 'summame':
                const fromChat = await textModule.getChatByName(restOfStr);
                if(fromChat){
                    msg.react('👍');
                    textModule.createSummary(200, msg, fromChat);
                }
                else{
                    msg.reply("Invalid input chat name, must be called this way: resumi [chatName]");
                }
                break;
            case 'gpt':
                msg.react('👍');
                textModule.runCompletion(restOfStr, "Sos un asistente que responde con simpleza y es muy inteligente").then(result => msg.reply(result));
                break;
            case 'log':
                const chat = await msg.getChat();
                const cantidad = Number(restOfStr);
                if (isNaN(cantidad)) {
                    msg.reply("Invalid input number, must be called this way: log [number]");
                } else {
                    msg.react('👍');
                    const reply = await textModule.getMessageLog(cantidad, chat);
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
                    await textModule.createSummary(cantidadMsgs, msg, currChat);
                }
                break;
            case 'atou':
                let ars = Number(restOfStr);
                if (isNaN(ars)) {
                    msg.reply("Invalid input number, must be called this way: atou [number]");
                } else {
                    msg.react('👍');
                    const arsToUsd = await miscModule.getAtoU(ars);
                    msg.reply("ARS to USD: U$D" + arsToUsd);
                }
                break;
            case 'utoa':
                let usd = Number(restOfStr);
                if (isNaN(usd)) {
                    msg.reply("Invalid input number, must be called this way: utoa [number]");
                } else {
                    msg.react('👍');
                    const usdToArs = await miscModule.getUtoA(usd);
                    msg.reply("USD to ARS: AR$" + usdToArs);
                }
                break;
            case 'reminder':
                let currDate = new Date();
                try{
                    let reminderDate = await textModule.getReminderDatetime(currDate, restOfStr, msg);
                    msg.reply("Recordatorio creado para: "+ reminderDate);
                    schedule.scheduleJob(reminderDate, () => {
                        msg.reply("aca esta tu recordatorio "+ textModule.apodoRandom())
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
                await textModule.createSummaryWrapper(msg);
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
                const dolaresStr = await miscModule.dolares();
                msg.reply(dolaresStr);
                break;
            case 'dolar':
                miscModule.dolar();
                
                break;
            case '!groupinfo':
                let chat = await msg.getChat();
                if (chat.isGroup) {
                    miscModule.groupInfo(chat, msg);
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
 * * ver como implementar reminders, o exportar reminders a google calendar
 * * 
 */