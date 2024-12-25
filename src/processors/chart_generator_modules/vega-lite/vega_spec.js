module.exports = function(data, options = {}) {
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
    markColor: "#63989a",
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
    }
  };

  // 合并用户选项和默认选项
  const finalOptions = { ...defaultOptions, ...options };

  const spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "background": finalOptions.background,
    "config": {
      "view": {"stroke": null}
    },
    "data": {
      "values": data
    }
  };

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
            ticks: false,
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

  return spec;
};

const vega = require('vega');
const vegaLite = require('vega-lite');
const fs = require('fs');
const getSpec = require('./vega_spec');

// 读取输入数据
const inputFile = process.argv[2];
const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 生成规范
const spec = getSpec(inputData);

// 编译规范
const vegaSpec = vegaLite.compile(spec).spec;

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