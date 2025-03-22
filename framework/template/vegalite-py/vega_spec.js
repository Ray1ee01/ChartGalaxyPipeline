module.exports = async function(spec) {
  return spec;
};

const vega = require('vega');
const vegaLite = require('vega-lite');
const fs = require('fs');
const getSpec = require('./vega_spec');

// 修改为异步执行
async function main() {
  // 读取输入数据
  const inputFile = process.argv[2];
  // const inputJson = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  //使用utf-8读取文件
  const inputJson = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const inputSpec = inputJson.spec;
  // const inputData = inputJson.data;
  // const inputOptions = inputJson.options;

  // 等待spec生成完成
  let spec = inputSpec;
  spec.background = null;
  spec.view = null;
  // 编译规范
  let vegaSpec = vegaLite.compile(spec).spec;

  try{
    // 把vegaSpec["scale"]中的所有字典的"paddingOuter"设置为和"paddingInner"相同
    for (let scale of vegaSpec["scales"]){
      if (scale["paddingInner"] !== undefined){
        scale["paddingOuter"] = scale["paddingInner"];
      }
    }
  }
  catch(e){
    console.error(e);
  }

  // console.log(JSON.stringify(vegaSpec, null, 2));
  // 创建新的View
  const view = new vega.View(vega.parse(vegaSpec))
  .renderer('svg')
  .initialize();  // 使用无头渲染器
  // console.log("view: ", view)

  // 导出SVG
  try {
    const svg = await view.toSVG();
    console.log(svg);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// 执行主函数
main().catch(err => {
  console.error(err);
  process.exit(1);
});