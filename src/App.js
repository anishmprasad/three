/* eslint-disable react/style-prop-object */
import React, { Component } from 'react';
// import logo from "./logo.svg";
import './App.css';
// import { start } from 'source/start';
import source from './source.json';
import * as THREE from 'three';
import ThreeWrapper from 'datsun/ThreeWrapper';
console.log(THREE);
console.log(source);

export default class App extends Component {
	componentDidMount() {}
	render() {
		return <ThreeWrapper />;
	}
}
