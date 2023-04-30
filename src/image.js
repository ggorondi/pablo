require('dotenv').config();
const Replicate = require('replicate');
const fs = require('fs');// https://nodejs.org/api/fs.html
const {Configuration, OpenAIApi} = require("openai");// https://platform.openai.com/docs/api-reference/introduction
const { MessageMedia } = require('whatsapp-web.js');// https://docs.wwebjs.dev/Chat.html 
const sharp = require('sharp');

const configuration = new Configuration({
    apiKey : process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });


const openai = new OpenAIApi(configuration);


// https://api-inference.huggingface.co/models/CompVis/stable-diffusion-v1-4
//
async function createImageHugging(data){
    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5",
            {
                headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
                method: "POST",
                body: JSON.stringify(data),
            }
	    );
        const result = await response.blob();

        const buffer  = Buffer.from(await result.arrayBuffer());
        fs.writeFileSync('image.png', buffer);
        const imgMedia = MessageMedia.fromFilePath('image.png');
        deleteFile('image.png');
        return imgMedia;
        
    }
    catch (err){
        console.log(err);
    }
}   

async function createImageOpenAI(prompto){
    try{
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
        const imgMedia = MessageMedia.fromFilePath('image.png');
        deleteFile('image.png');
        return imgMedia;
    }
    catch (err){
        console.log(err);
    }
    return;
}
async function formatImage(base64data){
    const bufferData = Buffer.from(base64data, 'base64');
    const image = sharp(bufferData);
  
    const metadata = await image.metadata();
    const size = Math.min(metadata.width, metadata.height);
    
    const resizedImage = image
        .resize(size, size, { fit: 'contain' })
        .png();
    
    const pngData = await resizedImage.toBuffer();
    const fileName = new Date().getTime() + '.png';
    fs.writeFileSync(fileName, pngData);
    return fileName;
    
}

async function createVariationOpenAI(msg){
    const base64Data = await downloadImg(msg);
    if(!base64Data) return;
    // Wrap createImage call in a promise
    const squarePngFile = await formatImage(base64Data);
    
        
    // Wait for createImage to finish before making OpenAI API call
    msg.react('👍');

    const response = await openai.createImageVariation(
        fs.createReadStream(squarePngFile),
        1,
        "256x256"
    );
    deleteFile(squarePngFile);
    
    const url = response.data.data[0].url;
    console.log(url);
    const img = await fetch(url);
    const blob = await img.blob();
    const buffer  = Buffer.from(await blob.arrayBuffer());
    const variationFile = new Date().getTime() + '.png';
    fs.writeFileSync(variationFile, buffer);
    const imgMedia = MessageMedia.fromFilePath(variationFile);
    deleteFile(variationFile);
    return imgMedia;
}

// NO FUNCIONA NI SE USA
async function createImageReplicate(prompt){
    try{
        const model = "ai-forever/kandinsky-2:601eea49d49003e6ea75a11527209c4f510a93e2112c969d548fbb45b9c4f19f";
        const input = {
            image: prompt,
        };
        const output = await replicate.run(model, { input });

        return output;
    }
    catch (err){
        console.log(err);
    }

}
function deleteFile(fileToDelete){
    fs.unlink(fileToDelete, (err) => {
        if (err) {
          console.error(err)
          return
        }
      })
}


async function downloadImg(msg){
    if(msg.hasMedia){    
        const media = await msg.downloadMedia();
        if(media.mimetype === 'image/png' || media.mimetype === 'image/jpeg' || media.mimetype === 'image/jpg'){
            const imageData = media.data;
            return imageData; // base64
        }
    }
    return;
}
async function translateImg(data){
    const response = await fetch(
        "https://api-inference.huggingface.co/models/facebook/deit-base-distilled-patch16-224",
        {
            headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
            method: "POST",
            body: data,
        }
    );
    const result = await response.json();
    return result;

}
/**
 * Opciones:
 * https://api-inference.huggingface.co/models/google/vit-base-patch16-224
 * https://api-inference.huggingface.co/models/microsoft/resnet-50
 * https://api-inference.huggingface.co/models/facebook/deit-base-distilled-patch16-224
 * Object detection:
 * https://api-inference.huggingface.co/models/facebook/detr-resnet-50
 * https://api-inference.huggingface.co/models/microsoft/beit-base-patch16-224-pt22k-ft22k
 * @param {*} msg 
 * @returns 
 */



async function imageToText(msg){ // https://huggingface.co/google/vit-base-patch16-224 
    try{
        const base64Data = await downloadImg(msg); //base64 img
        if(!base64Data) return;
        const buffer = Buffer.from(base64Data, 'base64'); //base64 --->>> buffer

        if(buffer){
            const result = await translateImg(buffer); // buffer --->>> hugging
            return result;
        }
        throw new Error("No se pudo descargar la imagen");
    }
    catch (err){
        console.log(err);
    }
}


/**
 * https://github.com/replicate/replicate-javascript
 * https://replicate.com/methexis-inc/img2prompt/api
 * @param {*} msg 
 * @returns 
 */
async function imageToPromptReplicate(msg){
    try{
        const base64Data = await downloadImg(msg);
        if(base64Data){
            const mimeType = "image/png";
            const dataURI = `data:${mimeType};base64,${base64Data}`;
            const model = "methexis-inc/img2prompt:50adaf2d3ad20a6f911a8a9e3ccf777b263b8596fbd2c8fc26e8888f8a0edbb5";
            const input = {
                image: dataURI,
            };
            const output = await replicate.run(model, { input });
            return output;
        }
        return;
    }
    catch (err){
        console.log(err);
    }
}



module.exports = {
    createImageHugging,
    createImageOpenAI,
    imageToText,
    imageToPromptReplicate,
    createImageReplicate,
    createVariationOpenAI,
    deleteFile
}