const fs = require('fs');
const names = JSON.parse(fs.readFileSync('./MOCK_DATA.json').toString());
const parsed = [];
names.forEach((name) => {
  parsed.push({ username: name.username.split(',')[0].split('(')[0] });
});
fs.writeFileSync('./PARSED_MOCK_DATA.json', JSON.stringify(parsed));
