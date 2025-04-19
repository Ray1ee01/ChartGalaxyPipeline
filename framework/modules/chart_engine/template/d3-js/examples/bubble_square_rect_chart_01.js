/* 
REQUIREMENTS_BEGIN
{
    "chart_type": "bubble_square_rect_chart",
    "chart_name": "bubble_square_rect_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

/* ────────── 配置区（可按需调节） ────────── */
const CFG = {
    fillRatio      : 1,   // 方块总面积 / 画布面积
    distPadding    : 0.0,    // 方块之间附加间隔（像素）
    maxDropTries   : 2,      // 布局失败后最多丢几个最小方块
    firstPositions : ["topleft", "center"], // 第 1 个方块尝试位置
    candidateSort  : "topleft",             // topleft / center / random
    minSide        : 30,     // 最小边长，防止过小
    maxSideFactor  : 0.9    // 最大边长 = H * 0.35
};
/* ────────── 主函数 ────────── */
function makeChart(containerSelector, dataJSON){

    /* ===== 1. 字段与数据检查 ===== */
    const cols = dataJSON.data.columns||[];
    const xField = cols.find(c=>c.role==="x")?.name;
    const yField = cols.find(c=>c.role==="y")?.name;
    const yUnit  = cols.find(c=>c.role==="y")?.unit==="none"?"":cols.find(c=>c.role==="y")?.unit??"";
    if(!xField||!yField){
        d3.select(containerSelector).html('<div style="color:red">缺少必要字段</div>');
        return;
    }
    const raw = dataJSON.data.data.filter(d=>+d[yField]>0);
    if(!raw.length){
        d3.select(containerSelector).html('<div>无有效数据</div>');
        return;
    }

    /* ===== 2. 尺寸与缩放 ===== */
    const fullW = dataJSON.variables?.width || 600;
    const fullH = dataJSON.variables?.height|| 600;
    const margin= {top:90,right:20,bottom:60,left:20};
    const W = fullW-margin.left-margin.right;
    const H = fullH-margin.top-margin.bottom;

    const totalArea   = W*H*CFG.fillRatio;
    const totalValue  = d3.sum(raw,d=>+d[yField]);
    const areaPerUnit = totalArea/totalValue;

    /* 每个节点：计算边长 s，颜色等 */
    const nodes = raw.map((d,i)=>({
        id   : d[xField]!=null?String(d[xField]):`__${i}__`,
        val  : +d[yField],
        area : +d[yField]*areaPerUnit,
        color: dataJSON.colors?.field?.[d[xField]] || d3.schemeTableau10[i%10],
        raw  : d
    })).sort((a,b)=>b.area-a.area);

    const maxSide = H*CFG.maxSideFactor;
    nodes.forEach(n=>{
        let s=Math.sqrt(n.area);                       // 使 s² = area
        s=Math.max(CFG.minSide,Math.min(s,maxSide));   // 限制
        n.s=s; n.area=s*s;
    });

    /* ===== 3. 几何工具 ===== */
    function overlap(a,b){ // 计算两个轴对齐正方形交集面积
        const ix = Math.max(0, Math.min(a.x+a.s, b.x+b.s) - Math.max(a.x,b.x));
        const iy = Math.max(0, Math.min(a.y+a.s, b.y+b.s) - Math.max(a.y,b.y));
        return ix*iy;
    }
    const okPair=(a,b)=> overlap(a,b) === 0;          // 不重叠（可改成阈值）
    const okAll =(n,placed)=>placed.every(p=>okPair(n,p));

    /* ===== 4. 候选位置 ===== */
    function genCandidates(node,placed){
        const list=[];
        // 第一个
        if(!placed.length){
            if(CFG.firstPositions.includes("topleft"))
                list.push({x:0, y:0});
            if(CFG.firstPositions.includes("center"))
                list.push({x:(W-node.s)/2, y:(H-node.s)/2});
            return list;
        }
        // 与已放置方块贴边（右侧 & 下侧）
        placed.forEach(p=>{
            // 右侧贴边
            const cx = p.x + p.s + CFG.distPadding;
            const cy = p.y;
            if(cx+node.s<=W && cy+node.s<=H) list.push({x:cx,y:cy});
            // 下侧贴边
            const cx2 = p.x;
            const cy2 = p.y + p.s + CFG.distPadding;
            if(cx2+node.s<=W && cy2+node.s<=H) list.push({x:cx2,y:cy2});
        });
        // 去重
        const uniq=new Map();
        list.forEach(p=>uniq.set(p.x+","+p.y,p));
        const arr=[...uniq.values()];
        // 排序
        if(CFG.candidateSort==="center"){
            arr.sort((a,b)=> (a.y+node.s/2-H/2)**2+(a.x+node.s/2-W/2)**2 -
                            (b.y+node.s/2-H/2)**2-(b.x+node.s/2-W/2)**2 );
        }else if(CFG.candidateSort==="random"){
            d3.shuffle(arr);
        }else{ // topleft
            arr.sort((a,b)=>a.y-b.y||a.x-b.x);
        }
        return arr;
    }

    /* ===== 5. DFS + 回溯 ===== */
    function dfs(idx,placed){
        if(idx===nodes.length) return true;
        const node=nodes[idx];
        for(const c of genCandidates(node,placed)){
            node.x=c.x; node.y=c.y;
            if(okAll(node,placed)){
                placed.push(node);
                if(dfs(idx+1,placed)) return true;
                placed.pop();
            }
        }
        return false;
    }
    let placed=[], success=dfs(0,placed);

    /* ===== 6. 失败 → 丢弃最小方块重试 ===== */
    let drop=0;
    while(!success && drop<CFG.maxDropTries && nodes.length){
        nodes.pop(); drop++;
        placed=[]; success=dfs(0,placed);
    }
    if(!success) placed=[];

    /* ===== 7. 绘图 ===== */
    d3.select(containerSelector).html("");
    const svg=d3.select(containerSelector)
        .append("svg")
        .attr("width","100%")
        .attr("height",fullH)
        .attr("viewBox",`0 0 ${fullW} ${fullH}`)
        .attr("preserveAspectRatio","xMidYMid meet")
        .style("max-width","100%")
        .style("height","auto");

    const g=svg.append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);

    const nodeG=g.selectAll("g.node")
        .data(placed,d=>d.id)
        .join("g")
        .attr("class","node")
        .attr("transform",d=>`translate(${d.x},${d.y})`); // 左上角

    /* 绘制正方形 */
    nodeG.append("rect")
        .attr("width",d=>d.s)
        .attr("height",d=>d.s)
        .attr("fill",d=>d.color)
        .attr("stroke","#fff")
        .attr("stroke-width",1);

    /* ===== 文本标签 ===== */
    const valueFF = dataJSON.typography?.annotation?.font_family || "Arial";
    const valueFW = dataJSON.typography?.annotation?.font_weight || "bold";
    const catFF   = dataJSON.typography?.label?.font_family || "Arial";
    const catFW   = dataJSON.typography?.label?.font_weight || "normal";
    const canvas=document.createElement("canvas"), ctx=canvas.getContext("2d");
    const getW=(t,f)=>{ctx.font=f;return ctx.measureText(t).width;};
    const minFont=8, maxFont=28;

    nodeG.each(function(d){
        const g=d3.select(this);
        const s=d.s;
        const centerX=s/2, centerY=s/2;

        const valText=`${d.val}${yUnit}`;
        const catText=d.id.startsWith("__")?"":d.id;

        // 初步字体大小
        let fSize=Math.max(minFont,Math.min(s*0.35,maxFont));
        // 逐减直到两行都能放下
        while(fSize>minFont &&
            (getW(valText,`${valueFW} ${fSize}px ${valueFF}`)>s*0.9 ||
            (catText && getW(catText,`${catFW} ${fSize}px ${catFF}`)>s*0.9))){
            fSize-=1;
        }
        // 自适应文字颜色
        const textColor = (()=>{
            const rgb=d3.color(d.color);
            const lum=(rgb.r*0.299+rgb.g*0.587+rgb.b*0.114)/255;
            return lum>0.6?"#000":"#fff";
        })();

        // 数值
        g.append("text")
        .attr("x",centerX).attr("y",centerY- (catText?fSize*0.55:0))
        .attr("text-anchor","middle")
        .attr("dominant-baseline","middle")
        .style("font-family",valueFF)
        .style("font-weight",valueFW)
        .style("font-size",fSize+"px")
        .style("fill",textColor)
        .style("pointer-events","none")
        .text(valText);

        // 维度标签
        if(catText && s>CFG.minSide*1.2){
            g.append("text")
            .attr("x",centerX).attr("y",centerY+fSize*0.55)
            .attr("text-anchor","middle")
            .attr("dominant-baseline","middle")
            .style("font-family",catFF)
            .style("font-weight",catFW)
            .style("font-size",fSize+"px")
            .style("fill",textColor)
            .style("pointer-events","none")
            .text(catText);
        }
    });

    return svg.node();
}
