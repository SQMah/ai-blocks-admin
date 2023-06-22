# Admin panel for data management

This is an admin panel for managing user and class information using Auth0 authentication.

## Features
- Create classes (unfinish)
    - teacherss, capacity and modules
- Manage classes (unfinish)
    - managed students enrolled
    - update avaiables modules
    - delete class
- Manage users
    - tecahers: update teaching class IDs
    - managed students: alter enrolled class ID, remove class ID and turn into unmanaged student
    - unmanaged students: manage avaible modules, enroll in class and turn into managed student
    - update expiration date for non-admin user
    - delete account
- Create account
    - manual data input
    - using csv file
- RESTful api for above features

## Todo
- [ ] crud user
- [ ] crud class
- [ ] batch create
- [ ] get user/class by id

## Getting started
### Auth 0 
- Create an Auth0 account
- In Application tab, create a regular web appliaction folowing the tutorial
    - In Settings tab,
        - Allowed Callback URL: {base URL}/api/auth/callback e.g.http://localhost:3000/api/auth/callback
        - Allowed Logout URL: {base URL} e.g. http://localhost:3000
- In Applications tab, create a Machine to Machine Applications
    - Select the Auth0 Management API
    - Provide all premssions for the application
- Create the roles in User Management/Roles
    <ol>
    <li>admin
    <li>teacher
    <li>managedStudent
    <li>unmanagedStudent
    </ol>
- For expiration to work, configurate the login flow and logout urls
    - Aadd a custom action in the Login flow in the action tab.
         - Example:
            ```js
            exports.onExecutePostLogin = async (event, api) => {
            const expiration = event.user.user_metadata?.account_expiration_date
            if(expiration == undefined) return
            if(isNaN(Date.parse(`${expiration}T00:00:00`))){
                api.redirect.sendUserTo("https://{Auth0 m2m app domain}/v2/logout")
            }
            const tdy = new Date()
            const data = new Date(`${expiration}T00:00:00`);
            if (data < tdy){
                api.redirect.sendUserTo("https://{Auth0 m2m app domain}/v2/logout")
            }
            };
            ```
        - Expirated user can be directed to specific URL by adding returnTo	parameter to the url
        - Add the logout URL for expirated users in Allowed Logout URL of the application setting
        - API reference: <https://auth0.com/docs/api/authentication#logout>
    - In the Setting/Advanced tab, add the logout url in the Allowed logout URLs
        - If the URL for expirated users is not specificed, the url should be same as the base URL of the application e.g. http://localhost:3000

### Email service
- Prepare a SMTP account that is able to send emails
    - These information is needed:
        <ol>
        <li>address for connecting to SMTP server
        <li>connection port number
        <li>account username
        <li>accoubnt password
        </ol>

### Application setting
- Create a `.env.local` file in the current directory
    ```ini
    
    AUTH0_SECRET = use [openssl rand -hex 32] to generate a 32 bytes value
    AUTH0_BASE_URL= base url of the app e.g. http://localhost:3000 
    AUTH0_ISSUER_BASE_URL=  'https://{Auth0 regular web app domain}' 
    AUTH0_CLIENT_ID= client id of the web app
    AUTH0_CLIENT_SECRET=the client secret of the regular web app

    AUTH0_API_CLIENT_ID= client id of the machine to machine app
    AUTH0_API_CLIENT_SECRET= client secrect of the m2m app
    AUTH0_API_BASE_URL='https://{Auth0 m2m app domain}/api/v2/'
    AUTH0_DB_CONNECTION_ID = database identifier of Username-Password-Authentication

    SMTP_SERVER = addr of stmp connection
    SMTP_USER = username of smtp account
    SMTP_PASSWORD = password of smtp pasword
    ```
- install dependences
    ```bash
    npm install
    ```
- In src/models/auth0_schemas, update the variable `roleMapping` by the correct role id in the Auth0 dash board
- Requries for admin user is on by default, you can either create an a/c and assign it to admin role in the Auth0 dash board, or the admin check can be turned off in `src/pages/api/users.ts` by setting `requireAdminCheck` to `false`
- Start for development
    ```bash
    npm run dev
    ```
- Start for production
    ```bash
    npm run build
    npm start
    ```

## Customisation
- Schemas and types
    - all types and schemas of API request and response can be found and updated in `src/models/api_schemas.ts` and `src/models/auth0_schemas.ts`
- Invitation email
    - Sender mail address, address formating, signing name can be configurated in `sendInvitation` from `src/lib/auth0_user_management.ts`
    - The email templates can be changed in `src/lib/email_template.ts`
    - For medias, te attachment setting can be found in `src/lib/mail_sender.ts`
    - Library reference: <https://nodemailer.com/about/>

