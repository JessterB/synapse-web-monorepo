import babel from 'rollup-plugin-babel'
import scss from 'rollup-plugin-scss'
import image from 'rollup-plugin-image'
import resolve from 'rollup-plugin-node-resolve'
import svg from 'rollup-plugin-svg'
import json from 'rollup-plugin-json'
import postprocess from 'rollup-plugin-postprocess'
import commonjs from 'rollup-plugin-commonjs'
// import minify from 'rollup-plugin-babel-minify'

const extensions = ['.js', '.jsx', '.ts', '.tsx']

export default {
	input: 'src/lib/index.tsx',
	external: [
		'react',
		'prop-types',
		'react-measure',
		'react-plotly.js/factory',
		'plotly.js-basic-dist',
		'katex',
		'react-tooltip',
		'markdownit',
		'markdownitSynapse',
		'markdownitSub',
		'markdownitSup',
		'markdownitCentertext',
		'markdownitSynapseHeading',
		'markdownitSynapseTable',
		'markdownitStrikethroughAlt',
		'markdownitContainer',
		'markdownitEmphasisAlt',
		'markdownitInlineComments',
		'markdownitBr',
		'markdownitMath',
		'sanitizeHtml',
		'react-transition-group',
		'sql-parser',
	],
	onwarn: function(warning) {
		// Skip certain warnings
	
		// Skip warning about AOT compiler (babel) use of the 'this' keyword
		if ( warning.code === 'THIS_IS_UNDEFINED' ) { return; }
	
		// console.warn everything else
		console.warn( warning.message );
	},
	plugins: [
		resolve( { extensions } ),
		babel({
			exclude: 'node_modules/**',
			runtimeHelpers: false,
			extensions
		}),
		commonjs( { extensions }),
		// Common js is used to handle the import of older javascript modules not using es6 
		image(),
		scss({output: './src/umd/synapse-react-client.production.styles.css'}),
		svg(),
		json(),
		// The plugin below is used to mitigate a limitation of rollup, which is that an import statement
		// can only be exposed as the import name used. This limitation is seen here-
		// 		import Plotly from 'react-plotly.js' 
		// doesn't work because the plotly CDN exposes a method createPlotlyComponent and not a class Plotly, so
		// we have to do this text transformation.
		postprocess([
			[
				/React.createElement\(Plot, { data: plotData, layout: layout }\)/g, 
				'React.createElement(createPlotlyComponent(Plotly), { data: plotData, layout: layout })'
			],
			[
				/reactTransitionGroup/g,
				'ReactTransitionGroup'
			],
			[
				// production is surrounded in "" so that its replaced as a string instead of as a variable
				// https://github.com/rollup/rollup/issues/487
				/process.env.NODE_ENV/g, '"production"' 
			]
		]),
		// minify the bundle
		// minify()
	],
	output: {
		globals: {
			'react' : 'React',
			'katex' : 'katex',
			'react-transition-group': 'ReactTransitionGroup',
			'react-plotly.js/factory': 'createPlotlyComponent',
			'plotly.js-basic-dist': 'Plotly',
			'react-measure': 'ReactMeasure',
			'react-tooltip': 'ReactTooltip',
			'markdownit': 'markdownit' ,
			'markdownitSynapse': 'markdownitSynapse' ,
			'markdownitSub': 'markdownitSub',
			'markdownitSup': 'markdownitSup',
			'markdownitCentertext': 'markdownitCentertext',
			'markdownitSynapseHeading': 'markdownitSynapseHeading',
			'markdownitSynapseTable': 'markdownitSynapseTable',
			'markdownitStrikethroughAlt': 'markdownitStrikethroughAlt',
			'markdownitContainer': 'markdownitContainer',
			'markdownitEmphasisAlt': 'markdownitEmphasisAlt',
			'markdownitInlineComments': 'markdownitInlineComments',
			'markdownitBr': 'markdownitBr',
			'markdownitMath': 'markdownitMath',
			'sanitizeHtml': 'sanitizeHtml',
			'prop-types' : 'PropTypes',
			'sql-parser' : 'sqlParser'
		},
		format: 'umd',
		name: 'SRC',
		file: './src/umd/synapse-react-client.production.min.js'
	}
}
