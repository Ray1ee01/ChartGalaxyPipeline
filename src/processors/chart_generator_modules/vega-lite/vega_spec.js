module.exports = function(data) {
    return {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "data": {
        "values": data
      },
      "mark": {
        "type": "bar",
      },
      "encoding": {
        "x": {"field": "category", "type": "nominal"},
        "y": {"field": "value", "type": "quantitative"}
      }
    };
  };

const vega = require('vega');
const vegaLite = require('vega-lite');
const fs = require('fs');
const getSpec = require('./vega_spec');

// 读取输入数据
const inputFile = process.argv[2];
// console.log("inputFile", inputFile);
const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
// 使用JSON.stringify美化输出，确保显示完整的数据结构
// console.log("完整的输入数据:", JSON.stringify(inputData, null, 2));

// 生成规范
const spec = getSpec(inputData);

// 编译规范
const vegaSpec = vegaLite.compile(spec).spec;
// console.log(vegaSpec);

// 创建新的View
const view = new vega.View(vega.parse(vegaSpec))
  .renderer('none');  // 使用无头渲染器
  // .initialize();

// 导出SVG
view.toSVG()
  .then(svg => {
    console.log(svg);  // 输出SVG到标准输出
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });