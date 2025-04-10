import os
import subprocess
import tempfile
from .file_utils import create_temp_file, cleanup_temp_file

def html_to_svg(html_file, output_svg=None, width=1200, height=800):
    """
    Convert an HTML file with ECharts or D3.js to SVG using Puppeteer.
    This requires a Node.js script to perform the conversion.
    
    Args:
        html_file: Path to the HTML file
        output_svg: Path to save the SVG file (optional)
        width: Width of the SVG
        height: Height of the SVG
    
    Returns:
        Path to the generated SVG file
    """
    if output_svg is None:
        output_svg = os.path.splitext(html_file)[0] + '.svg'
    
    # Create a temporary Node.js script for the conversion using CommonJS syntax
    js_script = """
    const puppeteer = require('puppeteer');
    const fs = require('fs');
    const path = require('path');

    (async () => {
        const browser = await puppeteer.launch({
            headless: 'new',  // Use the new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: %d, height: %d });
        
        try {
            // Load the HTML file
            await page.goto('file://' + path.resolve('%s'), { waitUntil: 'networkidle0' });
            
            // 减少等待时间
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if it's an ECharts or D3.js chart
            const isECharts = await page.evaluate(() => {
                return typeof echarts !== 'undefined';
            });
            
            let svgContent;
            
            if (isECharts) {
                // For ECharts, we'll check if the SVG has already been rendered to #svg-output
                const hasSvgOutput = await page.evaluate(() => {
                    return document.querySelector('#svg-output') !== null;
                });
                
                if (hasSvgOutput) {
                    // If we have the SVG output div, use its content
                    svgContent = await page.evaluate(() => {
                        const svgOutput = document.querySelector('#svg-output');
                        return svgOutput.innerHTML;
                    });
                    
                    console.log('Successfully retrieved SVG from #svg-output');
                } else {
                    // If there's no SVG output yet, try alternative method
                    console.log('No #svg-output found, using alternative method');
                    
                    // Add a button to trigger SVG export for ECharts
                    await page.evaluate(() => {
                        // Add a button to the page to trigger SVG export
                        const button = document.createElement('button');
                        button.id = 'export-svg-button';
                        button.style.display = 'none';
                        button.onclick = function() {
                            const chart = echarts.getInstanceByDom(document.querySelector('#chart-container'));
                            if (chart) {
                                // Force animation off
                                chart.setOption({animation: false});
                                
                                // Try to explicitly render as SVG
                                try {
                                    chart.setOption({
                                        renderer: 'svg'
                                    });
                                } catch (e) {
                                    console.error('Failed to set SVG renderer:', e);
                                }
                                
                                // Try to get SVG string and save it
                                try {
                                    const svgContent = chart.renderToSVGString();
                                    if (svgContent) {
                                        const svgOutput = document.createElement('div');
                                        svgOutput.id = 'manual-svg-output';
                                        svgOutput.style.display = 'none';
                                        svgOutput.innerHTML = svgContent;
                                        document.body.appendChild(svgOutput);
                                    }
                                } catch (e) {
                                    console.error('Failed to get SVG string:', e);
                                }
                            }
                        };
                        document.body.appendChild(button);
                        
                        // Click the button to trigger SVG export
                        document.getElementById('export-svg-button').click();
                    });
                    
                    // Wait for the manual SVG to be rendered
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Try to get the manual SVG content
                    const hasManualSvg = await page.evaluate(() => {
                        return document.querySelector('#manual-svg-output') !== null;
                    });
                    
                    if (hasManualSvg) {
                        svgContent = await page.evaluate(() => {
                            return document.querySelector('#manual-svg-output').innerHTML;
                        });
                        console.log('Successfully retrieved SVG from #manual-svg-output');
                    }
                }
            }
            
            // If we haven't got the SVG content yet, try to get it from the DOM
            if (!svgContent) {
                console.log('Attempting to extract SVG directly from DOM');
                svgContent = await page.evaluate(() => {
                    const container = document.querySelector('#chart-container');
                    if (!container) {
                        console.error('Chart container not found');
                        return null;
                    }
                    
                    const svgElement = container.querySelector('svg');
                    if (!svgElement) {
                        console.error('SVG element not found in container');
                        return null;
                    }
                    
                    // 检查SVG内是否有内容
                    if (svgElement.childNodes.length === 0) {
                        console.error('SVG element is empty');
                        return null;
                    }
                    
                    // 检查是否有path或g元素
                    const hasGraphicElements = svgElement.querySelectorAll('path, circle, rect, g, text').length > 0;
                    if (!hasGraphicElements) {
                        console.error('SVG has no graphic elements');
                        // 但如果强制需要，我们仍然返回它
                    }
                    
                    // 查看ECharts图表的情况
                    if (typeof echarts !== 'undefined') {
                        const chart = echarts.getInstanceByDom(container);
                        if (chart) {
                            // 再次强制关闭动画
                            chart.setOption({animation: false});
                            
                            // 等待一小段时间
                            setTimeout(() => {
                                // 再次触发重绘
                                chart.resize();
                            }, 100);
                        }
                    }
                    
                    // Clone the SVG to avoid modifying the original
                    const svgClone = svgElement.cloneNode(true);
                    
                    // Add width and height attributes if they don't exist
                    if (!svgClone.hasAttribute('width')) {
                        svgClone.setAttribute('width', container.clientWidth);
                    }
                    if (!svgClone.hasAttribute('height')) {
                        svgClone.setAttribute('height', container.clientHeight);
                    }
                    
                    // Add viewBox if it doesn't exist
                    if (!svgClone.hasAttribute('viewBox')) {
                        svgClone.setAttribute('viewBox', `0 0 ${container.clientWidth} ${container.clientHeight}`);
                    }
                    
                    // 输出SVG中元素的数量用于调试
                    console.log(`SVG contains ${svgClone.querySelectorAll('*').length} elements`);
                    console.log(`SVG contains ${svgClone.querySelectorAll('path').length} paths`);
                    console.log(`SVG contains ${svgClone.querySelectorAll('g').length} groups`);
                    console.log(`SVG contains ${svgClone.querySelectorAll('text').length} text elements`);
                    
                    // Return the SVG as a string
                    return svgClone.outerHTML;
                });
            }
            
            if (!svgContent) {
                // 尝试最后的方法 - 直接从页面截图
                console.log('Failed to extract SVG content, attempting screenshot as fallback');
                
                // 截图前等待额外时间确保绘制完成
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 1. 获取页面截图
                // 为了避免格式化问题，使用硬编码的文件名
                const outputPath = '${OUTPUT_SVG_PATH}';
                const pngPath = outputPath.replace('.svg', '.png');
                await page.screenshot({path: pngPath, fullPage: true});
                console.log('Created PNG screenshot as fallback: ' + pngPath);
                
                // 2. 创建一个简单的SVG，引用PNG
                const pngFileName = path.basename(pngPath);
                const viewWidth = ${WIDTH};
                const viewHeight = ${HEIGHT};
                
                svgContent = `<svg width="${viewWidth}" height="${viewHeight}" xmlns="http://www.w3.org/2000/svg">
                    <title>Chart (Fallback)</title>
                    <desc>This is a fallback SVG using a PNG screenshot.</desc>
                    <image href="${pngFileName}" width="${viewWidth}" height="${viewHeight}" />
                </svg>`;
                
                console.error('Generated fallback SVG with embedded PNG reference');
            }
            
            // Write SVG to file
            fs.writeFileSync('%s', svgContent);
        } catch (error) {
            console.error('Error generating SVG:', error);
            process.exit(1);
        } finally {
            await browser.close();
        }
    })();
    """
    
    # 替换JavaScript模板中的特殊占位符
    js_script = js_script.replace('${OUTPUT_SVG_PATH}', output_svg.replace('\\', '\\\\'))
    js_script = js_script.replace('${WIDTH}', str(width))
    js_script = js_script.replace('${HEIGHT}', str(height))
    
    # 应用Python格式化参数
    js_script = js_script % (
        width,                          # SVG viewport width
        height,                         # SVG viewport height
        html_file.replace('\\', '\\\\'),# HTML file path
        output_svg.replace('\\', '\\\\') # Final SVG output path
    )
    
    # Create a temporary script file with random name in tmp directory
    js_file = create_temp_file(prefix="html_to_svg_", suffix=".cjs", content=js_script)
    
    # Run the Node.js script
    try:
        # First, make sure puppeteer is installed
        try:
            subprocess.run(['npm', 'list', 'puppeteer'], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            print("Installing puppeteer...")
            subprocess.run(['npm', 'install', 'puppeteer'], check=True)
        
        # Run the converter script
        subprocess.run(['node', js_file], check=True)
        
        # Clean up - delete the temporary script
        cleanup_temp_file(js_file)
        
        return output_svg
    except subprocess.CalledProcessError as e:
        print(f"Error: {e}")
        
        # Clean up even if there was an error
        cleanup_temp_file(js_file)
            
        return None 