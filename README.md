# simplydegree-api
The api to be used with the simply degree frontend

# How to install and run
The following instructions assume you already have forked or otherwise copied the files in this repository to your local machine.
## backend.js
First, install [Node.js](https://nodejs.org/en/).

Afterwards, in a command prompt navigate to the simplydegree-api folder and run `npm install` which will automatically install all dependencies listed in the package.json file.

The file secret.txt must be created inside the Backend folder, and should contain the login credentials for the database like `[username]:[password]`.

Prof. Zia Ud Din: secret.txt will be provided to you in our submission folder.

Anyone else: you will need to modify backend.js to use your own MongoDB database by changing the `uri` constant.
