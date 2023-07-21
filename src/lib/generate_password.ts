const pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%*+=?@\^_|~"

const generatePassword = (length:number=12):string=>{
    if (length < 5) {
        throw new Error("Length must be greater than 4");
    }
  
    let hasDigit: boolean = false;
    let hasLower:boolean = false;
    let hasUpper:boolean = false;
    let hasSpecial:boolean = false;
    let pwd:string ="";
    
    while (!(hasLower && hasUpper && hasSpecial)) {
        pwd = "";
        hasLower = false;
        hasUpper = false;
        hasSpecial = false;
        
        for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const char = pool[randomIndex] as string;
        pwd += char;

        if (!hasDigit && /[0-9]/.test(char)) {
            hasDigit = true;
        }
        
        if (!hasLower && /[a-z]/.test(char)) {
            hasLower = true;
        }
        
        if (!hasUpper && /[A-Z]/.test(char)) {
            hasUpper = true;
        }
        
        if (!hasSpecial && /[!#$%*+=?@\\^_|~]/.test(char)) {
            hasSpecial = true;
        }
        }
    }
    
    return pwd;
}

export default generatePassword;
