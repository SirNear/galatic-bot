const { google } = require('googleapis');
const mongoose = require('mongoose');

const ROOT_FOLDER_NAME = 'Backups RP - Galatic Bot';
let cachedRootFolder = null;
const cachedSubfolders = new Map();

/**
 * Cria e retorna um cliente autenticado do Google Drive.
 * 1. Recarrega o .env do disco caso tenha sido atualizado em runtime.
 * 2. Caso as variáveis OAuth 2.0 não estejam no ambiente (ex: .env ignorado no deploy da Discloud),
 *    busca automaticamente do MongoDB (coleção botconfigs, _id: 'google_oauth').
 * 3. Faz fallback para a Service Account (GOOGLE_CREDENTIALS) apenas se OAuth não existir em ambos.
 */
async function getDriveClient() {
    try {
        require('dotenv').config({ override: true });
    } catch (_) {}

    let clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    let refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    if ((!clientId || !clientSecret || !refreshToken) && mongoose.connection?.readyState === 1) {
        try {
            const doc = await mongoose.connection.db.collection('botconfigs').findOne({ _id: 'google_oauth' });
            if (doc && doc.clientId && doc.clientSecret && doc.refreshToken) {
                clientId = doc.clientId;
                clientSecret = doc.clientSecret;
                refreshToken = doc.refreshToken;
                process.env.GOOGLE_OAUTH_CLIENT_ID = clientId;
                process.env.GOOGLE_OAUTH_CLIENT_SECRET = clientSecret;
                process.env.GOOGLE_OAUTH_REFRESH_TOKEN = refreshToken;
                console.log('[DRIVE] Credenciais OAuth 2.0 carregadas do MongoDB com sucesso.');
            }
        } catch (err) {
            console.warn('[DRIVE] Falha ao consultar credenciais OAuth no MongoDB:', err.message);
        }
    } else if (clientId && clientSecret && refreshToken && mongoose.connection?.readyState === 1) {
        mongoose.connection.db.collection('botconfigs').replaceOne(
            { _id: 'google_oauth' },
            { _id: 'google_oauth', clientId, clientSecret, refreshToken, updatedAt: new Date() },
            { upsert: true }
        ).catch(() => {});
    }

    if (clientId && clientSecret && refreshToken) {
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'https://developers.google.com/oauthplayground'
        );
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
        });
        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    console.warn('[DRIVE] Variáveis OAuth 2.0 ausentes (.env e MongoDB). Usando Service Account (GOOGLE_CREDENTIALS).');

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
 * Busca ou cria uma pasta no Google Drive.
 */
async function getOrCreateFolder(drive, folderName, parentId = null) {
    const sanitizedName = folderName.replace(/'/g, "\\'");
    let query = `name='${sanitizedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
        query += ` and '${parentId}' in parents`;
    }

    const res = await drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (res.data.files && res.data.files.length > 0) {
        const f = res.data.files[0];
        return {
            id: f.id,
            webViewLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
        };
    }

    const requestBody = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
        requestBody.parents = [parentId];
    }

    const created = await drive.files.create({
        requestBody,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
    });

    await drive.permissions.create({
        fileId: created.data.id,
        supportsAllDrives: true,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    }).catch(() => {});

    return {
        id: created.data.id,
        webViewLink: created.data.webViewLink || `https://drive.google.com/drive/folders/${created.data.id}`,
    };
}

/**
 * Garante a pasta principal "Backups RP - Galatic Bot" e, opcionalmente, uma subpasta (ex: por data).
 */
async function ensureBackupFolder(subfolderName = null, existingDrive = null) {
    const drive = existingDrive || await getDriveClient();

    if (!cachedRootFolder) {
        cachedRootFolder = await getOrCreateFolder(drive, ROOT_FOLDER_NAME, null);
    }

    if (!subfolderName) {
        return cachedRootFolder;
    }

    if (cachedSubfolders.has(subfolderName)) {
        return cachedSubfolders.get(subfolderName);
    }

    const sub = await getOrCreateFolder(drive, subfolderName, cachedRootFolder.id);
    cachedSubfolders.set(subfolderName, sub);
    return sub;
}

/**
 * Verifica se já existe um arquivo com o nome dado na pasta do Drive.
 */
async function findExistingFile(drive, fileName, folderId) {
    const sanitizedName = fileName.replace(/'/g, "\\'");
    const query = `name='${sanitizedName}' and '${folderId}' in parents and trashed=false`;
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
 * Faz upload de um Buffer como arquivo dentro da pasta organizada no Google Drive.
 *
 * @param {object} params
 * @param {Buffer} params.buffer - Conteúdo do arquivo
 * @param {string} params.fileName - Nome do arquivo no Drive
 * @param {string} params.mimeType - MIME type (ex: 'application/pdf', 'text/plain', 'application/zip')
 * @param {boolean} [params.skipIfExists=true] - Se true, pula upload se já existir
 * @param {string} [params.subfolderName=null] - Nome da subpasta dentro de "Backups RP - Galatic Bot"
 * @returns {Promise<{ id: string, webViewLink: string, alreadyExisted: boolean, folderId: string, folderLink: string }>}
 */
async function uploadToDrive(params) {
    const { buffer, fileName, mimeType, skipIfExists = true, subfolderName = null } = params;
    const drive = await getDriveClient();
    const targetFolder = await ensureBackupFolder(subfolderName, drive);

    if (skipIfExists) {
        const existingId = await findExistingFile(drive, fileName, targetFolder.id);
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
                folderId: targetFolder.id,
                folderLink: targetFolder.webViewLink,
            };
        }
    }

    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [targetFolder.id],
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
    }).catch(() => {});

    return {
        id: res.data.id,
        webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
        alreadyExisted: false,
        folderId: targetFolder.id,
        folderLink: targetFolder.webViewLink,
    };
}

module.exports = { uploadToDrive, findExistingFile, ensureBackupFolder, getDriveClient, ROOT_FOLDER_NAME };
