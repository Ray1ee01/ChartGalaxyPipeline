const TextToSVG = require('text-to-svg');
const fs = require('fs');

// 加载字体
const textToSVG = TextToSVG.loadSync();

// 读取输入数据
const inputPath = process.argv[2];
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const { text, fontSize, anchor = 'left top' } = inputData;

// 测量文本
const metrics = textToSVG.getMetrics(text, { 
    fontSize: parseFloat(fontSize),
    anchor: anchor 
});

// console.log(metrics)
// 输出结果
console.log(JSON.stringify({
    width: metrics.width,
    height: metrics.height,
    ascent: metrics.ascender,
    descent: metrics.descender
}));