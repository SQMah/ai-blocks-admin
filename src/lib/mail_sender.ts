import nodemailer from 'nodemailer';
import {google} from "googleapis"
import { htmlContent,textContent } from './email_template';

const sender_mail = process.env.SENDER_MAIL
if(!sender_mail) throw new Error("Mail address of sender is not set")

const client_id = process.env.OAUTH_CLIENT_ID;
const client_secret = process.env.OAUTH_CLIENT_SECRET;
const redirect_url = process.env.OAUTH_REDIRECT_URL;
const refresh_token = process.env.OAUTH_REFRESH_TOKEN;

if(!client_id||!client_secret||!redirect_url||!refresh_token) throw new Error("Env variables of OAuth are not set")

const oAuth2Client = new google.auth.OAuth2(client_id,client_secret,redirect_url )
oAuth2Client.setCredentials({refresh_token:refresh_token})


export const sendMail = async (subject:string,sender_name:string,
    receiver_name:string,reciever_mail:string,url:string,signig_name:string) =>{
        // console.log("creating connection")
    try {
        // throw new Error("random error") //for testing
        const accessToken = await oAuth2Client.getAccessToken();
        // console.log("token gain")
        const transporter = nodemailer.createTransport({
            // @ts-expect-error nodemailer
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: sender_mail,
                clientId: client_id,
                clientSecret: client_secret,
                refreshToken: refresh_token,
                accessToken: accessToken.token,
            },
        });
        // console.log("connected")
        await transporter.sendMail({
            from: `${sender_name} <${sender_mail}>`,
            to: `${receiver_name} <${reciever_mail}>`, // list of receivers
            subject: subject, // Subject line
            text: textContent(receiver_name,url,signig_name), // plain text body
            html: htmlContent(receiver_name,url,signig_name), // html body
            attachments: [{
                filename: 'robot.png',
                path:"public/email_images/robot.png",
                cid: 'image1' //same cid value as in the html img src
            },{
                filename: 'ai_blocks.png',
                path: "public/email_images/ai_blocks.png",
                cid: 'image2' //same cid value as in the html img src
            },]
          });
        
    } catch (error:any) {
        // console.error("OAuth problem")
        throw new Error(error.message??"Mailing Service Connection Failure")
    }
}



