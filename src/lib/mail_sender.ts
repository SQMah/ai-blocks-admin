import nodemailer from 'nodemailer';
import { htmlContent,textContent } from './email_template';

export const sendMail = async (subject:string,sender_name:string,sender_mail:string,
    receiver_name:string,reciever_mail:string,url:string,signig_name:string) =>{
    console.log("creating connection")
    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_SERVER,
        port:Number(process.env.SMTP_PORT)|0,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER, // generated ethereal user
            pass: process.env.SMTP_PASSWORD, // generated ethereal password
        },
    });
    console.log("connected")
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
}



