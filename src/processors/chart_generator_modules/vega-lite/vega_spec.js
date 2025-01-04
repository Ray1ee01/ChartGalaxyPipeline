const sharp = require('sharp');

module.exports = async function(data, options = {}) {
  // 默认配置
  const defaultOptions = {
    background: "#ffffff",
    title: null,
    subtitle: null,
    titleFontSize: 20,
    subtitleFontSize: 12,
    titleAnchor: "start",
    subtitleColor: "#808080",
    markType: "bar",
    // markColor: "#63989a",
    
    markColor: "#4f9a9a",
    markHeight: 0.75,
    showTooltip: true,
    xAxis: {
      showLabels: true,
      showGrid: false,
      showTicks: true,
      showDomain: true,
    },
    yAxis: {
      labelAlign: "right",
      labelPadding: 10,
      domainColor: "#000000",
      domainWidth: 0.5
    },
    legend: {
      orient: "top",
      title: "Legend",
      labelFontSize: 12,
      labelColor: "#000000"
    },
    xTitle: null,
    yTitle: null,
    textMark: {
      enabled: true,
      align: "left",
      baseline: "middle",
      dx: 5
    },
    iconAttachConfig: {
      method: "replacement",
      replaceMultiple: true,
      iconUrls: [
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
        "/data1/liduan/generation/chart/chart_pipeline/testicon/robot.png",
      ],
    }
  };

  // 使用深度合并来确保所有嵌套属性都被正确合并
  const deepMerge = (target, source) => {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  };

  // 合并用户选项和默认选项
  const finalOptions = deepMerge(JSON.parse(JSON.stringify(defaultOptions)), options);



  let spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "background": finalOptions.background,
    "config": {
      "view": {"stroke": null}
    },
    "data": {
      "values": data
    }
  };

  if (finalOptions.iconAttachConfig.method === "replacement" && finalOptions.iconAttachConfig.replaceMultiple) {
    let max_data_value = Math.max(...data.map(item => item.value));
    let min_data_value = Math.min(...data.map(item => item.value));
    let ratio = max_data_value / min_data_value;
    let unit = 0;
    if (ratio < 10 && ratio > 5) {
      unit = min_data_value;
    } else if (ratio < 5 && ratio > 2) {
      unit = min_data_value / 2;
    } else if (ratio < 2 && ratio > 1) {
      unit = min_data_value / 5;
    } else {
      unit = min_data_value;
    }

    // 转换数据为点图格式
    const newData = [];
    data.forEach((item, index) => {
      // 对每个数据点创建多个记录用于堆叠
      for (let i = 0; i < item.value/unit; i++) {
        newData.push({
          category: item.category,
          value: 1,  // 每个点的值都是1，用于计数
          flag: item.flag
        });
      }
    });
    data = newData;
    spec.data.values = data;

    // 修改图表配置
    spec.transform = [{
      "window": [{"op": "rank", "as": "id"}],
      "groupby": ["category"]
    }];

    spec.mark = {
      type: "image",
      opacity: 1,
      size: 200,
    };

    // 修改编码配置
    spec.encoding = {
      x: {
        field: "category",
        type: "ordinal",
        // title: finalOptions.xTitle,
        // axis: {
        //   labels: finalOptions.xAxis.showLabels,
        //   grid: finalOptions.xAxis.showGrid,
        //   ticks: finalOptions.xAxis.showTicks,
        //   domain: finalOptions.xAxis.showDomain
        // }
      },
      y: {
        field: "id",
        type: "ordinal",
        axis: null,
        sort: "descending"
      },
      url: {
        field: "flag",
        type: "nominal"
      }
    };
  }
  else{
    // 图表主体配置
  spec.mark = {
    type: finalOptions.markType,
    color: finalOptions.markColor,
    tooltip: finalOptions.showTooltip,
    height: { band: finalOptions.markHeight }
  };

  // 编码配置
  spec.encoding = {
    x: {
      field: "value",
      type: "quantitative",
      title: finalOptions.xTitle,
      axis: {
        labels: finalOptions.xAxis.showLabels,
        grid: finalOptions.xAxis.showGrid,
        ticks: finalOptions.xAxis.showTicks,
        domain: finalOptions.xAxis.showDomain
      }
    },
    y: {
      field: "category",
      type: "ordinal",
      title: finalOptions.yTitle,
      sort: null,
      axis: {
        domain: true,
        ticks: false,
        labelBaseline: "middle",
        labelAlign: finalOptions.yAxis.labelAlign,
        labelPadding: finalOptions.yAxis.labelPadding,
        domainColor: finalOptions.yAxis.domainColor,
        zindex: 1,
          domainWidth: finalOptions.yAxis.domainWidth
        }
      }
    };

  // 使用图层来组合条形图和文本
  spec.layer = [
    {
      // 条形图层
      "mark": {
        type: finalOptions.markType,
        color: finalOptions.markColor,
        tooltip: finalOptions.showTooltip,
        height: { band: finalOptions.markHeight }
      },
      "encoding": {
        x: {
          field: "value",
          type: "quantitative",
          title: null,
          axis: {
            labels: finalOptions.xAxis.showLabels,
            grid: finalOptions.xAxis.showGrid,
            ticks: finalOptions.xAxis.showTicks,
            domain: finalOptions.xAxis.showDomain
          }
        },
        y: {
          field: "category",
          type: "ordinal",
          title: null,
          sort: null,
          axis: {
            domain: true,
            ticks: true,
            // 设置tick的color
            tickColor: '#000000',
            labelBaseline: "middle",
            labelAlign: finalOptions.yAxis.labelAlign,
            labelPadding: finalOptions.yAxis.labelPadding,
            domainColor: finalOptions.yAxis.domainColor,
            zindex: 1,
            domainWidth: finalOptions.yAxis.domainWidth
          }
        }
      }
    }
  ];

  // 如果启用了文本标记，添加文本图层
  if (finalOptions.textMark.enabled) {
    spec.layer.push({
      "mark": {
        "type": "text",
        "align": finalOptions.textMark.align,
        "baseline": finalOptions.textMark.baseline,
        "dx": finalOptions.textMark.dx
      },
      "encoding": {
        "x": {"field": "value", "type": "quantitative"},
        "y": {"field": "category", "type": "ordinal", "sort": null},
        "text": {"field": "value", "type": "quantitative"}
      }
    });
  }
}

  // 添加标题配置
  if (finalOptions.title) {
    spec.title = {
      text: Array.isArray(finalOptions.title) ? finalOptions.title : [finalOptions.title],
      subtitle: Array.isArray(finalOptions.subtitle) ? finalOptions.subtitle : [finalOptions.subtitle],
      fontSize: finalOptions.titleFontSize,
      subtitleFontSize: finalOptions.subtitleFontSize,
      anchor: finalOptions.titleAnchor,
      subtitleColor: finalOptions.subtitleColor
    };
  }

  // // 在 spec.layer 数组中添加图标图层
  // if (finalOptions.iconAttachConfig.method === "juxtaposition" && 
  //     finalOptions.iconAttachConfig.attachTo === "y-axis" &&
  //     finalOptions.iconAttachConfig.iconUrls.length > 0) {
    
  //   const iconMapping = {};
  //   const iconSizes = {};
    
  //   // 直接为每个类别设置图标映射和固定的宽高比
  //   data.forEach((item, index) => {
  //     const iconUrl = finalOptions.iconAttachConfig.iconUrls[index];
  //     // console.log(item)
  //     if (iconUrl) {
  //       iconMapping[item.category] = iconUrl;
  //       iconSizes[item.category] = { aspectRatio: 1.0 }; // 假设所有图标都是正方形
  //     }
  //   });

  //   // 计算图标的基准大小
  //   const sizeRatio = finalOptions.iconAttachConfig.attachToMark?.sizeRatio ?? 0.9;
    
  //   // 添加图标图层，使用band比例来设置尺寸
  //   spec.layer.push({
  //     "mark": {
  //       "type": "image",
  //       "baseline": "middle",
  //       "align": "right",
  //       // "height": { band: finalOptions.markHeight * sizeRatio },
  //       // "width": 
  //       // "height": 20,
  //       "width": 20,
  //       "aspect": true
  //     },
  //     "encoding": {
  //       "y": {
  //         "field": "category",
  //         "type": "ordinal",
  //         "sort": null
  //       },
  //       "x": {
  //         "value": -finalOptions.iconAttachConfig.attachToAxis.padding
  //       },
  //       "url": {
  //         "field": "flag",
  //         "type": "nominal",
  //       },
  //     }
  //   });

  //   // 调整y轴的标签位置，使用最大图标宽度
  //   const maxIconWidth = Math.max(
  //     ...Object.values(iconSizes).map(({ aspectRatio }) => 
  //       20
  //     )
  //   );

  //   spec.layer.forEach(layer => {
  //     if (layer.encoding && layer.encoding.y && layer.encoding.y.axis) {
  //       layer.encoding.y.axis.labelPadding = 
  //         finalOptions.yAxis.labelPadding + 
  //         maxIconWidth + 
  //         finalOptions.iconAttachConfig.attachToAxis.padding;
  //     }
  //   });
  // }

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
  const inputJson = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const inputData = inputJson.data;
  const inputOptions = inputJson.options;

  // 等待spec生成完成
  const spec = await getSpec(inputData, inputOptions);

  // 编译规范
  const vegaSpec = vegaLite.compile(spec).spec;

  // 创建新的View
  const view = new vega.View(vega.parse(vegaSpec))
    .renderer('none');  // 使用无头渲染器

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