import React, { Component } from 'react';
import { Spin } from "antd";
import{feature} from 'topojson-client';
import axios from 'axios';
//地图形状
import { geoKavrayskiy7 } from 'd3-geo-projection';
import { geoGraticule, geoPath } from 'd3-geo';
import { select as d3Select } from 'd3-selection';
import { schemeCategory10 } from "d3-scale-chromatic";
import * as d3Scale from "d3-scale";
import { timeFormat as d3TimeFormat } from "d3-time-format";


import { WORLD_MAP_URL,SATELLITE_POSITION_URL,SAT_API_KEY} from "../constants";


const width = 960;
const height = 600;

class WorldMap extends Component {
    constructor(){
        super();
        this.state = {
            isLoading: false,
            isDrawing: false
          };
          this.map = null;
          //颜色取值范围
          this.color = d3Scale.scaleOrdinal(schemeCategory10);
      
        this.refMap = React.createRef();
        this.refTrack= React.createRef();
    }

    generateMap = land =>{
        //将数据转换为地图上的点
        const projection = geoKavrayskiy7()
            .scale(170)
            .translate([width / 2, height / 2])
            .precision(.1);

        //find canvas
        const canvas = d3Select(this.refMap.current)
            .attr("width",width)
            .attr("height",height);
    
        const canvas2 = d3Select(this.refTrack.current)
            .attr("width", width)
            .attr("height", height);
      
        
        //是2d还是3d, 要修改所以用let
        const context = canvas.node().getContext("2d");
        const context2 = canvas2.node().getContext("2d");

        //画笔
        let path = geoPath()
                    .projection(projection)
                    .context(context);
        
        //经纬度
        const graticule =geoGraticule();

        //画经纬线
        land.forEach(ele => {
            context.fillStyle = '#B3DDEF';
            context.strokeStyle = '#000';
            context.globalAlpha = 0.7;
            context.beginPath();
            path(ele);
            context.fill();
            context.stroke();

            context.strokeStyle = 'rgba(220, 220, 220, 0.1)';
            context.beginPath();
            path(graticule());
            context.lineWidth = 0.1;
            context.stroke();

            context.beginPath();
            context.lineWidth = 0.5;
            //经纬度
            path(graticule.outline());
            context.stroke();
            
        });

        //让这些属性可以被函数外部访问
        this.map = {
            projection: projection,
            graticule: graticule,
            context: context,
            context2: context2
          };
      
    }

    componentDidMount(){
        axios.get(WORLD_MAP_URL)
        .then(res=>{
            console.log(res);
            const {data} = res;
            const land =  feature(data, data.objects.countries).features;
            this.generateMap(land);

        })
        .catch(err=>console.log('err in fetch world map data',err));
    }

    //在did mount之后调用
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (prevProps.satData !== this.props.satData) {
            const {
                latitude,
                longitude,
                elevation,
                altitude,
                duration
              } = this.props.observerData;
              const endTime = duration * 60;


              this.setState({
                isLoading: true
              });

              
              const urls = this.props.satData.map(sat=>{
                  const {satid} = sat;
                  const url = `/api/${SATELLITE_POSITION_URL}/${satid}/${latitude}/${longitude}/${elevation}/${endTime}/&apiKey=${SAT_API_KEY}`;
                  return axios.get(url);
              })

              Promise.all(urls)
              .then(res=>{
                const arr = res.map(sat => sat.data);
                this.setState({
                  isLoading: false,
                  isDrawing: true
                });
      
                //draw
                //case1:isDrawing? true =>cannot track
                //case2:isdrawing? false =>track

                if (!prevState.isDrawing) {
                    this.track(arr);
                  } else {
                    const oHint = document.getElementsByClassName("hint")[0];
                    oHint.innerHTML =
                      "Please wait for these satellite animation to finish before selection new ones!";
                  }
                
        

              })
              .catch(e=>{
                console.log("err in fetch satellite position -> ", e.message);

              });
        }
    
    
    }

    track = data => {
        if (!data[0].hasOwnProperty("positions")) {
          throw new Error("no position data");
          return;
        }

        const len = data[0].positions.length;
        const { duration } = this.props.observerData;
        const { context2 } = this.map;

        //current time
        let now = new Date();

        let i = 0;
        let timer = setInterval(() => {
            let ct = new Date();
      
            let timePassed = i === 0 ? 0 : ct - now;
            //get current time * 60 加速60倍

            //加速逻辑：源数据是未来的轨道数据，乘60之后每次render的是60秒后的数据
            //原速度
            //let time = new Date(now.getTime() +  timePassed);
            //加速之后
            let time = new Date(now.getTime() +  60*timePassed);

            //decide where to display
            context2.clearRect(0, 0, width, height);
            //时间戳的样式
            context2.font = "bold 14px sans-serif";
            context2.fillStyle = "#333";
            context2.textAlign = "center";
            context2.fillText(d3TimeFormat(time), width / 2, 10);
            
            //case1 : when to stop drawing
            if (i >= len) {
                clearInterval(timer);
                this.setState({ isDrawing: false });
                const oHint = document.getElementsByClassName("hint")[0];
                oHint.innerHTML = "";
                return;
              }
              
            //case2: draw every position for each satallite
              data.forEach(sat => {
                const { info, positions } = sat;
                this.drawSat(info, positions[i]);
              });
              
              //increase i
              //原速度
              //i += 1;
              //加速之后
              i+=60;
            }, 1000);
        
    
    }    

    drawSat = (sat,pos) =>{
        const{satlongitude,satlatitude} = pos;
        if (!satlongitude || !satlatitude) return;

        const { satname } = sat;
        const nameWithNumber = satname.match(/\d+/g).join("");
    
        const { projection, context2 } = this.map;
        const xy = projection([satlongitude, satlatitude]);
    
        //拿到色号
        context2.fillStyle = this.color(nameWithNumber);
        //开始画图
        context2.beginPath();
        context2.arc(xy[0], xy[1], 4, 0, 2 * Math.PI);
        context2.fill();
        //title
        context2.font = "bold 11px sans-serif";
        context2.textAlign = "center";
        context2.fillText(nameWithNumber, xy[0], xy[1] + 14);
    
    }

    render() {
        const { isLoading } = this.state;

        return (
            <div className="map-box">
                {isLoading ? (
                <div className="spinner">
                    <Spin tip="Loading..." size="large" />
                </div>
                ) : null}
    
                <canvas className="map" ref={this.refMap}></canvas>
                <canvas className="track" ref={this.refTrack}></canvas>
                <div className="hint"></div>
            </div>
        );
    }
}

export default WorldMap;