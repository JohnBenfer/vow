import React, { useReducer, useEffect, useLayoutEffect, useContext } from 'react';
import { StyleSheet, View, SafeAreaView, FlatList, TouchableHighlight, TouchableOpacity, ToastAndroid, Platform } from 'react-native';
import { Text, Icon, Tooltip } from 'react-native-elements';
import Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@react-navigation/native';
import LoadingSpinner from './LoadingSpinner';
import UserList from './UserList';
import * as firebase from 'firebase';
import { RemoveBetsFromUserFile, RemoveLobbyFromUserFile, RemovePinnedLobbyFromUserFile, WriteUserToFile } from '../Util';
import Bet from './Bet';
import * as FileSystem from 'expo-file-system';
import { UserFilePath } from '../Constants';
import { UserColors } from '../ColorContext';
import ThemeColors from '../assets/ThemeColors';

const Lobby = (props) => {
  const [state, setState] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    {
      lobby: props.route.params.lobby,
      users: props.route.params.lobby.users,
      bets: [],
      loading: false,
      pressed: false,
    }
  );
  const toolTipRef = React.useRef();
  const { userColors } = useContext(UserColors);
  const theme = useTheme();
  
  useEffect(() => {
    const usersRef = firebase.database().ref('Lobby/' + state.lobby.id).child('users');
    usersRef.on('value', (data) => {
      let newLobby = state.lobby;
      newLobby.users = data.val();
      setState({ users: data.val(), lobby: newLobby });
      props.route.params.handleNewUser(newLobby);
    });

    return () => {
      usersRef.off();
    };
  }, []);

  useEffect(() => {
    const betsRef = firebase.database().ref('Bet');
    betsRef.orderByChild('lobbyId').equalTo(state.lobby.id).on('value', (data) => {
      let newBets = [];
      data.forEach((bet) => {
        if (bet.val().status !== 'closed') {
          newBets.push({ ...bet.val(), id: bet.key });
        }
      });
      setState({ bets: sortBets(newBets.reverse()) });
    });

    return () => {
      betsRef.off();
    }
  }, []);

  useLayoutEffect(() => {
    props.navigation.setOptions({
      headerRight: () => (
        <Tooltip
          ref={toolTipRef}
          withOverlay={false}
          withPointer={false}
          containerStyle={styles.menuContainer}
          skipAndroidStatusBar
          popover={
            <View>
              <TouchableHighlight underlayColor={ThemeColors.card} style={styles.menuItem} onPress={leaveLobby}>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemText}>Leave Lobby</Text>
                </View>
              </TouchableHighlight>
            </View>
          }
        >
          <TouchableHighlight underlayColor={ThemeColors.background} style={styles.menuHighlight} onPress={() => toolTipRef.current.toggleTooltip()}>
            <Icon name="dots-three-vertical" type="entypo" size={20} color={ThemeColors.text}/>
          </TouchableHighlight>
        </Tooltip>
      ),
    });
  }, [props.navigation, state.bets]);

  const sortBets = (bets) => {
    let incompleteBets = [];
    let completeBets = bets.filter((bet) => {
      if (bet.status === 'complete') {
        return true;
      }
      incompleteBets.push(bet);
    });
    return incompleteBets.concat(completeBets);
  }

  const leaveLobby = async () => {
    const { user } = props.route.params;
    toolTipRef.current.toggleTooltip()
    setState({ loading: true });

    const lobbyRef = firebase.database().ref('Lobby/' + state.lobby.id);
    lobbyRef.transaction((lobby) => {
      if (lobby) {
        if (lobby.users && lobby.users.find(u => u.username === user.username)) {
          lobby.users.splice(lobby.users.findIndex(u => u.username === user.username), 1);
          if (lobby.users.length === 0) {
            lobby.active = false;
          }
        }
      }

      return lobby;
    });
    await RemoveLobbyFromUserFile(state.lobby.id);
    RemovePinnedLobbyFromUserFile(state.lobby.id);
    removeBets();
    props.route.params.handleRemoveLobby(state.lobby);
    

    setState({ loading: false });
    props.navigation.goBack();
  }

  const removeBets = () => {
    const { user } = props.route.params;
    let betsToRemove = [];
    state.bets.forEach((bet) => {
      const betRef = firebase.database().ref('Bet/' + bet.id);
      betRef.transaction((b) => {
        if (b && b.status !== 'complete') {
          if (b.createdBy === user.username) {
            betsToRemove.push(bet.id);
            b.status = 'closed';
          } else {
            if (b.users.find(u => u.username === user.username)) {
              if (b.status === 'open') {
                betsToRemove.push(bet.id);
                b.users.splice(b.users.findIndex(u => u.username === user.username), 1);
              } else if (b.users.length < 2) {
                b.status = 'complete';
              }
            }
          }
        }

        return b;
      });
    });
    console.log('bets to remove in lobby');
    console.log(betsToRemove);
    RemoveBetsFromUserFile(betsToRemove);
  }

  const createBet = () => {
    props.navigation.navigate('CreateBetScreen', { user: props.route.params.user, lobby: state.lobby });
  };

  const copyLobbyCode = () => {
    Clipboard.setString(state.lobby.code.toUpperCase());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'android') {
      ToastAndroid.showWithGravity("Copied to clipboard", ToastAndroid.SHORT, ToastAndroid.BOTTOM);
    }
  }

  const renderBetCard = (bet) => {
    return (
      <Bet bet={bet} colors={userColors} user={props.route.params.user} navigation={props.navigation} />
    );
  };

  const header = (
    <View style={[styles.detailsContainer, {backgroundColor: theme.colors.background}]}>
      <View>
        <Text style={[styles.lobbyName, {fontFamily: 'Audio-Wide'}]}>{state.lobby.name}</Text>
      </View>
      <TouchableOpacity style={{alignSelf: 'center'}} onLongPress={copyLobbyCode} activeOpacity={0.7}>
        <Text style={styles.lobbyCode}>{state.lobby.code.toUpperCase()}</Text>
      </TouchableOpacity>
      <UserList users={state.users} colors={userColors} />
    </View>
  );

  const emptyList = (
    <View style={styles.emptyList}>
      <Text>There are no vows for this lobby.</Text>
    </View>
  );

  const listBottomPadding = <View style={{ paddingBottom: 10 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <LoadingSpinner spinning={state.loading} />
      <View style={styles.list}>
        <FlatList
          ListHeaderComponent={header}
          ListFooterComponent={listBottomPadding}
          ListEmptyComponent={emptyList}
          stickyHeaderIndices={[0]}
          data={state.bets}
          renderItem={({ item }) => renderBetCard(item)}
          keyExtractor={(bet) => bet.id}
        />
      </View>
      <View style={styles.button}>
        <Icon
          reverse
          name="md-add"
          type="ionicon"
          color={ThemeColors.button}
          onPress={createBet}
        />
      </View>
    </SafeAreaView>
  );
};

export default Lobby;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  detailsContainer: {
    paddingTop: 20,
  },
  menuContainer: {
    borderColor: ThemeColors.border,
    borderWidth: 1,
    marginTop: -15,
    overflow: 'hidden'
  },
  menuItem: {
    width: 150,
    height: 50,
  },
  menuItemTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ThemeColors.background,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: -20,
  },
  menuHighlight: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  lobbyName: {
    textAlign: 'center',
    fontSize: 30,
    color: ThemeColors.textTitle,
    textShadowColor: ThemeColors.textTitle,
    textShadowRadius: Platform.OS === 'android' ? 12 : 6,
    paddingVertical: 2,
  },
  lobbyCode: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  button: {
    alignSelf: 'flex-end',
    position: 'absolute',
    bottom: 0,
    paddingRight: 5,
    marginBottom: 5
  },
  list: {
    paddingBottom: 0,
    flex: 1,
  },
  emptyList: {
    alignSelf: 'center',
    paddingTop: '45%',
  },
});
