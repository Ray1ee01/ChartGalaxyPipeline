const echarts = require('echarts');
const fs = require('fs');


async function main(){
    const inputFile = process.argv[2];
    const inputJson = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const inputOption = inputJson.option;
    const chart = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: 1000,
        height: 1000,
    });

    // use setOption as normal
    chart.setOption(inputOption);

    // Output a string
    const svgStr = chart.renderToSVGString();
    console.log(svgStr);

    // 退出
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});