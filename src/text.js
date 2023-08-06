const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');// https://docs.wwebjs.dev/Chat.html 
const {encode, decode} = require('gpt-3-encoder') // https://www.npmjs.com/package/gpt-3-encoder


/**
 * opciones para [chatLog] -> [resumen] apis
 * https://api-inference.huggingface.co/models/philschmid/bart-large-cnn-samsum
 * https://api-inference.huggingface.co/models/facebook/bart-large-cnn
 */
/**
 * 
 * Crea resumen de chat donde fue mandado msg
 * @param {msg} msg 
 */
async function createSummaryWrapper(msg){
    const chat = await msg.getChat();
    await createSummary(100, msg,chat);
}
/**
 * Crea resumen de chat de fromChat
 * @param {msg} msg 
 * @param {chat} fromChat 
 */
async function createSummary(amount, msg, fromChat){
    const chatLog = await getMessageLog(amount, fromChat);

    const gptPreambulo = 'Quiero que resumas la conversación que pongo a continuación, en menos de 100 palabras. Salteate detalles irrelevantes. También conta la cantidad de veces que cada persona mandó mensajes por el nombre que aparece asi "[nombre]", Y en un pequeño parrafo aparte escribí la cantidad de mensajes que mandó cada uno y el humor promedio de sus mensajes con este formato: [nombre] - numero de mensajes {humor}:\n';
    let result = await runCompletion(gptPreambulo + chatLog, "Sos un asistente que resume conversaciones.");      
    return result;
}
/**
 * le pide a chatgpt que analice y devuelva el datetime apropiado para el reminder
 * @param {Date} currentDate
 * @param {string} requestString 
 */
async function getReminderDatetime(currentDate, requestString){
    try {
        const gptPreambulo = 'You are a program that helps with creating a new datetime based on a specific request. The current datetime is exactly: "'+ currentDate.toString() +'. Your response should be a new datetime, written in the same format, but based on this request for modification that is in spanish: "'+ requestString +'". Assume the same year or month or day or hour or timezone if they are not explicitly specified in the modification. Respond with ONLY the datetime, in the same english format as the current time. Dont add any more text than the datetime.\n';
        var newDate = await runCompletion(gptPreambulo, "You are a simple computer program");   
        console.log(currentDate.toString())  
        console.log(newDate.toString());
        newDate = extractRegex(newDate);
        newDateDate = new Date(newDate);
        return newDateDate;
    }
    catch (err) {
        console.log("getReminderDateTime error: "+err)
        throw err;
    }
}

function extractRegex(dateString) {
    const dateFormat = /([a-z]{3}) ([a-z]{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT([+-]\d{4}) \(([\w\s]+)\)/i; //tiene que estar en este formato que es el Date.toString() format, los // delimitan el regex, el i señala case insensitive, ^ fija que este en el start, $ el final.
    const match = dateString.match(dateFormat);
    if (match) {
      return match[0];
    } else {
      throw new Error("Invalid date string format.");
    }
    /*
    const dateFormat = /^([a-z]{3}) ([a-z]{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT([+-]\d{4}) \(([\w\s]+)\)$/i; //tiene que estar en este formato que es el Date.toString() format, los // delimitan el regex, el i señala case insensitive, ^ fija que este en el start, $ el final.
    if (dateFormat.test(dateString)) {
        return dateString;
      } else {
        throw new Error("Invalid date string format.");
      }
      */
  }

function apodoRandom(){ // (no inclusivo)
    const strings = ['capitan atlantico', 'ministro de seguridad', 'arquitecto de ilusiones', 'capo', 'bestia', 'pedazo de sexy', 'corazon de melocoton', 'domador de gusanos', 'patron', 'jefe', 'batiman', 'lindo UwU'];
    const randomIndex = Math.floor(Math.random() * strings.length);
    return strings[randomIndex];
}



async function runCompletion2(message, speciality){
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
        console.log('falla el runCompletion2')
        console.log(process.env.OPENAI_API_KEY)
    }
}
/**
 * Funcion que envia el mensaje a la api de open ai, y luego recibe el mensaje de chatGPT 
 * @param {string} message mensaje que se envia a la api de open ai
 * @param {string} speciality que tipo de persona es el ai (asistente, ruso drogado, etc)
 * @returns el mensaje de chatGPT.
 */
async function runCompletion(message, speciality){
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
    }
    
}

//funcion que crea objeto MySearchOptions que se pasan a fetchMessages()
function MySearchOptions(limit, fromMe) {
    this.limit = limit;
    this.fromMe = fromMe;
}


/**
 * Devuelve una conversacion entera con los ultimos amount mensajes de un chat 
 * @param {number} amount 
 * @param {chat} fromChat 
 * @returns 
 */
async function getMessageLog( amount, fromChat){
    try{
        const [mensajes, tokenCount] = await fetchAmount(amount, fromChat);
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
        return [linea.join("\n"), tokenCount];
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
        const tokenCount = await calculateTokensInArrayOfMessages(mensajes);
        console.log(`Total tokens: ${tokenCount}`);
        return [mensajes, tokenCount]; // devuelve un conjunto de objetos message
    
    }
    catch(err){
        console.log('fetch error: ' + err);
    }
    
}
async function calculateTokensInArrayOfMessages(mensajes) {
    let tokenCount = 0;
    const wordRegex = /\b\w+\b/g; // regular expression to match words
  
    for (const mensaje of mensajes) {
      const words = mensaje.body.match(wordRegex) || []; // split message into words
      tokenCount += words.length * 0.75; // add to token count
    }
  
    return tokenCount;
  }

/**
 * Devuelve el chat con el nombre chatName  
 * @param {string} chatName 
 * @returns 
 */
async function getChatByName(clientChats, chatName) {
    for (const chat of clientChats) {
        if (chat.name === chatName) {
            return chat;
        }
    }
}




module.exports = {
    createSummaryWrapper,
    createSummary,
    getReminderDatetime,
    extractRegex,
    apodoRandom,
    runCompletion,
    runCompletion2,
    MySearchOptions,
    getMessageLog,
    fetchAmount,
    getChatByName
}

