const { google } = require('googleapis');

const DRIVE_FOLDER_ID = '1n5rkbn5TbTEK2X-NTTnWVQXjzq9vUssB';

/**
 * Cria e retorna um cliente autenticado do Google Drive usando a Service Account do .env.
 */
function getDriveClient() {
    let credentials;
    try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (e) {
        throw new Error('GOOGLE_CREDENTIALS inválido no .env. Verifique o JSON da service account.');
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
    });

    // Tornar o arquivo público para visualização
    await drive.permissions.create({
        fileId: res.data.id,
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
