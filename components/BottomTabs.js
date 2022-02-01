import * as React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, Text } from 'react-native-elements';
import Home from './Home';
import Lobby from './Lobby';
import CreateBet from './CreateBet';
import BetFeed from './BetFeed';
import BetOptions from './BetOptions';
import ThemeColors from '../assets/ThemeColors';

const BottomTab = createBottomTabNavigator();

const BottomTabNavigator = (props) => {
  let route = props.route.params.navigationRef.current.getCurrentRoute().name;

  return (
    <BottomTab.Navigator initialRouteName="Home">
      <BottomTab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          tabBarLabel: ({ color }) => (
            <Text style={{ fontSize: 10, color: route === 'HomeScreen' || route === 'Root' ? color : ThemeColors.text, opacity: route === 'HomeScreen' || route === 'Root' ? 1 : 0.5 }}>Home</Text>
          ),
          tabBarIcon: ({ color }) => (
            <Icon
              type="ionicon"
              size={30}
              style={{ marginBottom: -3, opacity: route === 'HomeScreen' || route === 'Root' ? 1 : 0.5 }}
              name="md-home"
              color={route === 'HomeScreen' || route === 'Root' ? color : ThemeColors.text}
            />
          ),
        }}
        initialParams={{ user: props.route.params?.user }}
      />
      <BottomTab.Screen
        name="Vow Feed"
        component={BetFeedNavigator}
        options={{
          tabBarLabel: 'Vow Feed',
          tabBarIcon: ({ color }) => (
            <Icon
              type="ionicon"
              size={30}
              style={{ marginBottom: -3 }}
              name="md-list"
              color={color}
            />
          ),
        }}
        initialParams={{ user: props.route.params.user }}
      />
      <BottomTab.Screen
        name="Lobby"
        component={Lobby}
        options={{ headerShown: false, tabBarButton: () => null }}
      />
    </BottomTab.Navigator>
  );
};

const HomeStack = createStackNavigator();
const HomeNavigator = (props) => {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        headerBackImage: () => (            
          <Icon
            type="ionicon"
            size={30}
            style={{ marginLeft: 10, marginBottom: 0 }}
            name="md-arrow-back"
            color={ThemeColors.text}
          />
        ),
      }}
    >
      <HomeStack.Screen
        name="HomeScreen"
        component={Home}
        options={{ 
          headerShown: false,
          title: 'Home',
          headerLeft: null,
        }}
        initialParams={{ user: props.route.params.user }}
      />
      <HomeStack.Screen
        name="LobbyScreen"
        component={Lobby}
        options={{ 
          headerShown: true, 
          title: 'Lobby',
          headerTitleAlign: 'center',
        }}
        initialParams={{ lobby: props.route.params?.lobby }}
      />
      <HomeStack.Screen
        name="CreateBetScreen"
        component={CreateBet}
        options={{ headerShown: false }}
        initialParams={{ lobby: props.route.params?.lobby, user: props.route.params?.user }}
      />
      <HomeStack.Screen
        name="BetOptionsScreen"
        component={BetOptions}
        options={{ headerShown: false }}
      />
    </HomeStack.Navigator>
  );
};

const BetStack = createStackNavigator();
const BetFeedNavigator = (props) => {
  return <BetStack.Navigator>
    <BetStack.Screen
      name="Vow Feed"
      component={BetFeed}
      options={{ 
        headerShown: true,
        title: 'Vows',
        headerTitleAlign: 'center',
        headerLeft: null,
      }}
      initialParams={{ user: props.route.params?.user }}
    />
  </BetStack.Navigator>;
};

export default BottomTabNavigator;