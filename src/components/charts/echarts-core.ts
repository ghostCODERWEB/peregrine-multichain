// ECharts, registered piece by piece. The package's default entry bundles every chart, component and
// renderer (about 1 MB before compression); Peregrine draws eight chart types with the SVG renderer.
// Add a chart type or component here before using it in an option, or ECharts ignores it.
import * as echarts from 'echarts/core';
import { BarChart, CandlestickChart, GaugeChart, LineChart, PieChart, RadarChart, ScatterChart, TreemapChart } from 'echarts/charts';
import { AxisPointerComponent, DataZoomComponent, GraphicComponent, GridComponent, MarkLineComponent, RadarComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart, BarChart, ScatterChart, TreemapChart, CandlestickChart, RadarChart, PieChart, GaugeChart,
  GridComponent, TooltipComponent, TitleComponent, DataZoomComponent, MarkLineComponent, RadarComponent, GraphicComponent, AxisPointerComponent,
  SVGRenderer,
]);

export { echarts };
