const common = {
  request_information: ['Please share the nearest landmark so our crew can find the site.', 'कृपया पास का पहचान चिह्न बताएं ताकि हमारी टीम सही स्थान पर पहुँच सके।'],
  visit: ['Our crew visited the site. Findings: ', 'हमारी टीम ने स्थल का निरीक्षण किया। निरीक्षण का विवरण: '],
  blocked: ['Work is waiting for materials. The next step is ', 'सामग्री की प्रतीक्षा है। अगला कदम है '],
}
const departments = {
  water: {
    update: ['The water supply team is checking the affected line.', 'जल आपूर्ति टीम प्रभावित पाइपलाइन की जाँच कर रही है।'],
    resolve: ['The water supply team completed the following repair: ', 'जल आपूर्ति टीम ने यह मरम्मत पूरी की: '],
  },
  waste: {
    update: ['The sanitation team is arranging a collection visit.', 'सफाई टीम कचरा उठाने की व्यवस्था कर रही है।'],
    resolve: ['The sanitation team completed collection at ', 'सफाई टीम ने यहाँ से कचरा उठा लिया है: '],
  },
}

export function replyTemplate(department, action, language) {
  const pair = departments[department]?.[action] ?? common[action]
  return pair?.[language === 'hi' ? 1 : 0]
}
