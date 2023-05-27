
export const htmlContent = (name:string, url:string,signing_name:string):string =>{
    const content:string = 
    `<html>
        <body>
            <div>Hi ${name},</div>
            <br>
            <div>We hope you're excited to learn about AI!</div>
            <div>Note that this is still an entry version of the content and we're still evolving, but we hope you enjoy it.</div>
            <br>
            <div>Here's your personal login:</div>
            <div>link: <a href="aiblocks.org">aiblocks.org</a></div>
            <div>Set your password: <a href=${url}>${url}</a></div>
            <br>
            <div>Cheers,</div>
            <div>${signing_name}</div>
            <br>
            <div>
                <img src="cid:image1" width="47" height="87" style="margin-right: 20px;" alt="happy-robot.png"/> 
                <img src="cid:image2" width="134" height="47" alt="Artboard 1@4x.png"/>
            </div>        
        </body>
    </html>`

    return content
    
}

export const textContent = (name:string, url:string,signing_name:string):string =>{
    const content:string = 
    `Hi ${name},

    We hope you're excited to learn about AI!
    Note that this is still an entry version of the content and we're still evolving, but we hope you enjoy it.
    
    Here's your personal login:
    link: aiblocks.org
    Set your password: ${url}
    
    Cheers,
    ${signing_name}`

    return content
}

