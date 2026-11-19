const { google } = require('googleapis');

const DRIVE_FOLDER_ID = '1n5rkbn5TbTEK2X-NTTnWVQXjzq9vUssB';

/**
 * Cria e retorna um cliente autenticado do Google Drive.
 * Prioriza OAuth 2.0 (conta pessoal com cota normal) se configurado no .env,
 * ou faz fallback para a Service Account (GOOGLE_CREDENTIALS).
 */
function getDriveClient() {
    if (
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
        process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    ) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_OAUTH_CLIENT_ID,
            process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            'https://developers.google.com/oauthplayground'
        );
        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
        });
        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    let credentials;
    try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (e) {
        throw new Error('Credenciais do Google Drive ausentes ou inválidas no .env (configure OAuth 2.0 ou GOOGLE_CREDENTIALS).');
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
}

/**
 * Verifica se já existe um arquivo com o nome dado na pasta do Drive.
 * @param {object} drive - Cliente do Drive autenticado
 * @param {string} fileName - Nome do arquivo a verificar
 * @returns {Promise<string|null>} ID do arquivo existente ou null
 */
async function findExistingFile(drive, fileName) {
    const sanitizedName = fileName.replace(/'/g, "\\'");
    const query = `name='${sanitizedName}' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`;
    const res = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });
    const files = res.data.files;
    if (files && files.length > 0) return files[0].id;
    return null;
}

/**
 * Faz upload de um Buffer como arquivo no Google Drive.
 * Se já existir um arquivo com o mesmo nome na pasta, retorna o ID existente sem fazer upload.
 *
 * @param {object} params
 * @param {Buffer} params.buffer - Conteúdo do arquivo
 * @param {string} params.fileName - Nome do arquivo no Drive
 * @param {string} params.mimeType - MIME type (ex: 'application/pdf', 'text/plain', 'application/zip')
 * @param {boolean} [params.skipIfExists=true] - Se true, pula upload se já existir
 * @returns {Promise<{ id: string, webViewLink: string, alreadyExisted: boolean }>}
 */
async function uploadToDrive(params) {
    const { buffer, fileName, mimeType, skipIfExists = true } = params;
    const drive = getDriveClient();

    if (skipIfExists) {
        const existingId = await findExistingFile(drive, fileName);
        if (existingId) {
            const fileInfo = await drive.files.get({
                fileId: existingId,
                fields: 'id, webViewLink',
                supportsAllDrives: true,
            }).catch(() => null);
            return {
                id: existingId,
                webViewLink: fileInfo?.data?.webViewLink || `https://drive.google.com/file/d/${existingId}/view`,
                alreadyExisted: true,
            };
        }
    }

    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [DRIVE_FOLDER_ID],
            mimeType,
        },
        media: {
            mimeType,
            body: stream,
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
    });

    // Tornar o arquivo público para visualização
    await drive.permissions.create({
        fileId: res.data.id,
        supportsAllDrives: true,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    }).catch(() => {}); // Não bloqueia se não conseguir tornar público

    return {
        id: res.data.id,
        webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
        alreadyExisted: false,
    };
}

module.exports = { uploadToDrive, findExistingFile, DRIVE_FOLDER_ID };
