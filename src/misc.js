const axios = require('axios');
const moment = require('moment');

var forbiddenChats = ["SO"];
var forbiddenUsers = [];


function pushToForbiddenChats(chat){
    const indexToRemove = forbiddenChats.indexOf(chat);
    if (indexToRemove == -1) {
        forbiddenChats.push(chat);
    }
}

function popFromForbiddenChats(chat){
    const indexToRemove = forbiddenChats.indexOf(chat);
    if (indexToRemove !== -1) {
        forbiddenChats.splice(indexToRemove, 1);   
    }
}
function getForbiddenChats(){
    return forbiddenChats;
}
function isForbiddenChat(chat){
    return forbiddenChats.includes(chat);
}

/*
function pushToForbidden(chat){
    const indexToRemove = forbiddenChats.indexOf(chat.name);
    if (indexToRemove == -1) {
    forbiddenChats.push(chat.name);
    }
}

function popFromForbidden(chat){
    const indexToRemove = forbiddenChats.indexOf(chat.name);
    if (indexToRemove !== -1) {
    myArray.splice(indexToRemove, 1);   
    }
}

function isForbiddenChat(chat){
    return forbiddenChats.includes(chat.name);
}
*/

async function randomizeActivity(){
    let response = await axios.get('https://www.boredapi.com/api/activity');
    let act = response.data;
    return act.activity;

}

async function dolar(){
    let dolar = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
    let dolarData = dolar.data[1];
    let dolarStr = `
                *${dolarData.nombre}*
_____________________________________            
Compra: *${dolarData.compra}*         
_____________________________________            
Venta: *${dolarData.venta}*       
_____________________________________            
_Fuente: https://dolarhoy.com/_
            `;
            return dolarStr;
}

async function dolares(){
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
    return dolaresStr;
}

function groupInfo(chat){
    
    return `
                        *Group Details*
Name: ${chat.name}
Description: ${chat.description}
Created At: ${chat.createdAt.toString()}
Created By: ${chat.owner.user}
Participant count: ${chat.participants.length}
                    `;
}


async function getUtoA(usd){
    let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
    let compra = parseFloat(dolares.data[1].compra);
    let venta = parseFloat(dolares.data[1].venta);
    let dolarblue = (compra + venta) / 2;
    let usdToArs = usd * dolarblue;
    usdToArs = parseFloat(usdToArs.toFixed(2));
    return usdToArs;
}
async function getAtoU(ars){
    let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
    let compra = parseFloat(dolares.data[1].compra);
    let venta = parseFloat(dolares.data[1].venta);
    let dolarblue = (compra + venta) / 2;
    let arsToUsd = ars / dolarblue;
    arsToUsd = parseFloat(arsToUsd.toFixed(2));
    return arsToUsd;
}





function help(){
    return `
                    *Comandos*
_____________________________________            
*summa*: resume 200 msg's del chat, tiene que ser llamada en el chat que se quiere resumir y manda por privado
_____________________________________            
*summa [n]*: resume n msg's del chat, tiene que ser llamada en el chat que se quiere resumir y manda por privado
_____________________________________            
*summame (n) [chat]*: resume n msg's de "chat" puede ser llamada desde cualquier chat (groupo o privado)    
_____________________________________           
*reminder [prompt]* : te manda un recordatorio en base a "prompt" (ej: reminder en 5 min)
_____________________________________            
*gpt [prompt]*: responde gpt a "prompt"
_____________________________________            
*dolares*: dolares info en tiempo real
_____________________________________            
*dolar*: dolar blue info en tiempo real
_____________________________________
*atou [number]*: "$numeber" ARS to USD en tiempo real
_____________________________________
*utoa [number]*: "$numeber" USD to ARS en tiempo real
_____________________________________            
*[audio]-> texto*: responde con "texto" a un audio y te transcribe el audio a texto     
_____________________________________
*[audio]-> gptaudio*: mandas un audio y te responde gpt           
_____________________________________
*randomize*: random activity in english
_____________________________________
*img [prompt]*: hace una imagen con "prompt" y te la manda
_____________________________________
*[img] -> variation*: genera una imagen, similar a "img", con dallee y te la manda
_____________________________________
*[img] -> convert*: genera un prompt de lo que cree que es la imagen y te lo manda
_____________________________________
*[img] -> yolo*: genera el prompt que va a generar una imagen
_____________________________________
*[img] -> sticker*: genera un sticker de la imagen
_____________________________________
*!prohibidos*: muestra los chats en los que el bot no responde
_____________________________________
*!prohibir [chat]* hace que el bot no responda en "chat"
_____________________________________
*!desprohibir [chat]* hace que el bot responda en "chat"
_____________________________________
*!log [n]*: muestra n msg's log de la conversacion        
_____________________________________
*!groupinfo*: info del grupo (tiene que ser llamada en un grupo)
_____________________________________
*!help*: muestra este mensaje
_____________________________________
                `;
}



module.exports = {
    help,
    dolar,
    dolares,
    groupInfo,
    getUtoA,
    getAtoU,
    randomizeActivity,
    isForbiddenChat,
    pushToForbiddenChats,
    popFromForbiddenChats,
    getForbiddenChats
}