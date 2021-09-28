import React, {Component} from 'react';
import { Row, Col } from 'antd';
import axios from 'axios';
import SatSetting from './SatSetting';
import SatelliteList from './SatelliteList';
import {NEARBY_SATELLITE, SAT_API_KEY, STARLINK_CATEGORY} from "../constants";
import WorldMap from './WorldMap';


class Main extends Component {
    constructor(){
        super();
        this.state = {
            satInfo: null,
            satList:null,
            settings: null,
            isLoadingList: false
        };
    }

    showNearbySatellite = (setting) => {
        this.setState({
            settings: setting
        })
        this.fetchSatellite(setting);
    }

    fetchSatellite =(setting)=>{
        //parameter for apis
        const {latitude,longitude,elevation,altitude} = setting;
        //url
        const url = `/api/${NEARBY_SATELLITE}/${latitude}/${longitude}/${elevation}/${altitude}/${STARLINK_CATEGORY}/&apiKey=${SAT_API_KEY}`;
        this.setState({
            isLoadingList: true
        });
     
        //request
        axios.get(url)
        .then(response=>{
            console.log(response.data);
            this.setState({
                satInfo: response.data,
                isLoadingList: false
            })
 
        })
        .catch(error=>{
            console.log('err in fetch satellite ->',error);
        })
    }

    showMap = (selected) => {
        console.log('show on the map',selected);
        this.setState(preState=>({
            ...preState,
            //给的是 selected的 copy，而不是引用
            satList:[...selected]
        }));
    }



    render() {
        const { satInfo,isLoadingList,satList,settings } = this.state;
        return (
        <Row className='main'>
            <Col span={8} >
                <SatSetting onShow = {this.showNearbySatellite}/>
                <SatelliteList satInfo={satInfo}
                               isLoad={isLoadingList}
                               onShowMap={this.showMap}/>

            </Col>
            <Col span={16} className="right-side">
                <WorldMap 
                satData={satList}
                observerData={settings}/>
            </Col>
        </Row>

        );
    }
}
export default Main;
