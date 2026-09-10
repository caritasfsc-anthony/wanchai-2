const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const properties = new Map();
let email = 'anthonykwok@caritasfsc.edu.hk';
let clears = 0, writes = 0, fail = false;
const context = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => properties.get(k), setProperty: (k,v) => properties.set(k,v) }) },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({users:[{email}]}) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
  SpreadsheetApp: { openById: () => ({}), flush() {} },
};
vm.createContext(context);
vm.runInContext(readFileSync(__dirname + '/Code.gs', 'utf8'), context);
const originalClear = context.clearAll_;
context.clearAll_ = () => { clears++; if (fail) throw Error('offline'); };
const request = {requestId:'12345678-1234-1234-1234-123456789012',idToken:'mock'};
email = 'student@example.com';
assert.throws(() => context.resetFieldwork_(request));
assert.equal(clears,0);
email = 'anthonykwok@caritasfsc.edu.hk';
assert.equal(context.resetFieldwork_(request).complete,true);
context.resetFieldwork_(request);
assert.equal(clears,1,'duplicate reset must not erase new data');
context.appendRawSubmission_ = () => writes++;
context.writeToAnalysisSheets_ = () => writes++;
context.updateExportStatus_ = () => writes++;
assert.throws(() => context.legacySubmit_({}, {id:'old'},'hash','initial'));
assert.equal(writes,0,'old export must not restore cleared data');
context.legacySubmit_({}, {id:'new'},'hash',request.requestId);
assert.equal(writes,3);
const retry = {...request,requestId:'22345678-1234-1234-1234-123456789012'};
fail = true;
assert.throws(() => context.resetFieldwork_(retry));
assert.equal(JSON.parse(properties.get('reset-' + retry.requestId)).complete,false);
fail = false;
assert.equal(context.resetFieldwork_(retry).complete,true);
const ranges = [];
originalClear({getSheetByName: name => ({getLastRow:()=>1,getRange:range=>({clearContent:()=>ranges.push([name,range])}),getRangeList:list=>({clearContent:()=>ranges.push([name,list])})})});
assert.deepEqual(JSON.parse(JSON.stringify(ranges)),[
 ['Part 1 Building','B6:I9'],
 ['Part 2 Sustainability',['C6:J9','C13:J16','C20:J23']],
 ['Part 2 Shop style',['C6:J9','C14:J17','C22:J25','C30:J33']],
]);
console.log('PASS: teacher validation, reset retry, duplicate reset, stale exports, targeted analysis input ranges');
