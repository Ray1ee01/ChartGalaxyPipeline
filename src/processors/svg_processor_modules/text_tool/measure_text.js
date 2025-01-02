const TextToSVG = require('text-to-svg');
const fs = require('fs');

// 加载字体
const textToSVG = TextToSVG.loadSync("/data1/liduan/generation/chart/chart_pipeline/src/processors/svg_processor_modules/text_tool/Microsoft_Sans_Serif.ttf");

// 读取输入数据
const inputPath = process.argv[2];
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const { text, fontSize, anchor = 'left top'} = inputData;

let measure_text = text;
// replace space with 'o'
measure_text = measure_text.replace(/\s/g, 'w');
// replace '/' with 'o'
measure_text = measure_text.replace(/\//g, 'o');

// 测量文本
const metrics = textToSVG.getMetrics(measure_text, {
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