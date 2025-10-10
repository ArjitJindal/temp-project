# Email Templates

This folder contains email templates written in React using the `react-email` library.

## Previewing the Templates

To preview the email templates, follow these steps:

1. Make sure you have Node.js and npm installed on your machine.
2. Open a terminal and navigate to the root directory of this project.
3. Run the following command to install the dependencies:

   ```shell
   npm install
   ```

4. Once the dependencies are installed, run the following command to start the development server:

   ```shell
   npm run dev
   ```

5. Open your browser and navigate to http://localhost:3000/

## Exporting to HTML

To export the email templates to HTML files, follow these steps:

4. run the following command to export the templates to HTML:

   ```shell
   npm run export
   ```

5. The exported HTML files will be generated in a specified output directory.

These HTML files are then needed to be placed in the tarpon/infra/auth0/email-templates folder and configured in tarpon/infra/auth0/cdktf-auth0-resources.ts
