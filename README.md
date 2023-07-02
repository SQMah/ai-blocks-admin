# Admin panel for data management

This is an admin panel for managing user and class information using Auth0 authentication and DynamoDB for class databse.


##TODO

- [ ] complete task handler
    - [x] search users
    - [ ] update users by email
    - [ ] delete user by email
    - [ ] create class
    - [x] get class by id
    - [x] batch get class by ids
    - [ ] update class by id (maybe almost done)
    - [ ] delete class by id
    - [x] send invitation by email
- [ ] change api schemas (use email as user index, changed search user schema)
- [ ] implement actual api using task handler
- [ ] check front end
- [ ] testing

## Features
- Create classes 
    - create class with inputed teachers, capacity and modules
- Manage classes 
    - manage students enrolled
    - update class capacity and class name
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
    - using csv file to perform batch create
- RESTful api for above features


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

### DynamoDB
- Create an table for class in Dynamo DB
- Create an IAM user in IAM features/Users
    - Provide `AdministratorAccess` for the user
    - In Security credentials, create access key as local code usage
- These information is needed:
    <ol>
    <li>region of DB
    <li>access key ID 
    <li>secret access key
    </ol>
### Email service (OAuth)
- Follow  [this tutorial](https://www.youtube.com/watch?v=-rcRf7yswfM&t=747s&ab_channel=MafiaCodes) to set up OAuth on Google Clould
    - These information is needed:
        <ol>
        <li>client id
        <li>client secret
        <li>refresh token
        </ol>
    - P.S. Remember to add the sender emial as test user in OAuth consent screen
    - Touble shooting: when encountering unauthorized client, try aauthorize the api again in playground with client id and secret. If problem still exists, rebuild credential in console.
### Application setting
- Create a `.env.local` file in the current directory
    ```ini
    # Auth 0 
    AUTH0_SECRET = use [openssl rand -hex 32] to generate a 32 bytes value
    AUTH0_BASE_URL= base url of the app e.g. http://localhost:3000 
    AUTH0_ISSUER_BASE_URL=  'https://{Auth0 regular web app domain}' 
    AUTH0_CLIENT_ID= client id of the web app
    AUTH0_CLIENT_SECRET=the client secret of the regular web app

    AUTH0_API_CLIENT_ID= client id of the machine to machine app
    AUTH0_API_CLIENT_SECRET= client secrect of the m2m app
    AUTH0_API_BASE_URL='https://{Auth0 m2m app domain}/api/v2/'
    AUTH0_DB_CONNECTION_ID = database identifier of Username-Password-Authentication

    # OAuth
    SENDER_MAIL = mail address of the OAuth a/c
    OAUTH_CLIENT_ID = OAuth Client ID
    OAUTH_CLIENT_SECRET= OAuth Client Secret
    OAUTH_REDIRECT_URL= OAuth redirect URl, usually "https://developers.google.com/oauthplayground"
    OAUTH_REFRESH_TOKEN= OAuth refresh token"1//04oP7X2DVPRyvCgYIARAAGAQSNwF-L9IrjpxZVOu3IfVs125zhl6kbnMGuuQXjuo16rOfKbMkoEPq1322Q_ovz5mSbhu10far1pY"

    #DynamoDb
    DYNAMODB_REGION = aws region, e.g.  ap-northeast-1
    AWS_ACCESS_KEY_ID= Access key ID of IAM user
    AWS_SECRET_ACCESS_KEY= Access secret key of IAM user

    CLASS_TABLE_NAME = table name of the class table in DynamoDB

    #Configurated for require admin user to access api, default to be True if not set
    REQUIRE_ADMIN = TRUE/FALSE
    ```
- install dependences
    ```bash
    npm install
    ```
- In src/models/auth0_schemas, update the variable `roleMapping` by the correct role id in the Auth0 dash board
- Requries for admin user is on by default, you can either create an a/c and assign it to admin role in the Auth0 dash board, or the admin check can be turned off in `.env.local` by setting `REQUIRE_ADMIN` to `FALSE` (default `TRUE`)
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
    - all types and schemas of API request and response can be found and updated in `src/models/api_schemas.ts`,`src/models/auth0_schemas.ts` and `src/models/dynamoDB_schemas.ts`.
- Invitation email
    - Address formating, signing name can be configurated in `sendInvitation` from `src/lib/auth0_user_management.ts`
    - The email templates can be changed in `src/lib/email_template.ts`
    - For medias, te attachment setting can be found in `src/lib/mail_sender.ts`
    - Library reference: <https://nodemailer.com/about/>

