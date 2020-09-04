const fs = require('fs');
const path = require('path');

const secretsFilePath = 'secrets.txt'
const outputFile = 'videowikisecretkeys_secret.yml';

function generateSecretFile(data) {
    return `
apiVersion: v1
kind: Secret
metadata:
    name: videowikisecretkeys

type: Opaque
data:
${['  '].concat(data).join('\n  ')}

`
}

fs.readFile(secretsFilePath, (err, data) => {
    // console.log(err, )
    const keyValues = [];
    data.toString().split('\n').forEach((item) => {
        if (item && item.trim() && item.indexOf('#') !== 0) {
            const parts = item.trim().split('=')
            const key = parts[0];
            parts.shift();
            const value = parts.join('=');
            console.log(key)
            keyValues.push({ key, value });
        }
    })
    let finalData = []
    keyValues.forEach((keyVal) => {
        const encodedVal = new Buffer(keyVal.value).toString('base64');
        finalData.push(keyVal.key + ': ' + encodedVal.replace(/\n/g, ''));
    })
    // filePaths.push(path.join(__dirname, 'videowikisecretkeys_secret.yml'))
    fs.writeFileSync(path.join(__dirname, outputFile), generateSecretFile(finalData))

});