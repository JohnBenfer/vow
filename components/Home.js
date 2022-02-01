import React from 'react';
import { StyleSheet, View, SafeAreaView, FlatList, StatusBar, Platform, TouchableHighlight, LayoutAnimation, UIManager } from 'react-native';
import { Input, Button, Overlay, Text, Icon } from 'react-native-elements';
import { useTheme } from '@react-navigation/native';
import LoadingSpinner from './LoadingSpinner';
import * as firebase from 'firebase';
import { ReadUserFromFile, WriteUserToFile, AddLobbyToUserFile, CreateRandomColors, RemovePinnedLobbyFromUserFile, AddPinnedLobbyToUserFile } from '../Util';
import * as FileSystem from 'expo-file-system';
import { UserFilePath } from '../Constants';
import UserList from './UserList';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import { UserColors } from '../ColorContext';
import { Image } from 'react-native';
import ThemeColors from '../assets/ThemeColors'
import * as Font from 'expo-font';
// Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
// Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
// Haptics.selectionAsync();

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

class Home extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      lobbies: [],
      pinnedLobbies: [],
      lobbyCode: '',
      lobbyName: '',
      loading: false,
      lobbyDoesNotExist: false,
      createLobbyToggled: false,
      fontsLoaded: false,
    };
  }

  async loadFonts() {
    await Font.loadAsync({'Audio-Wide': require('../assets/fonts/Audiowide-Regular.ttf')});
    this.setState({ fontsLoaded: true });
  }
  /**
   * Receives the current user as this.props.route.params.user
   */
  componentDidMount() {
    this.loadFonts();
    setTimeout(() => SplashScreen.hideAsync(), 400);
    // prevents going back to signup page
    this.props.navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      // console.warn(e);
    });
    this.loadLobbies();
  }

  createUserColors = (lobbies) => {
    if (!lobbies) {
      return;
    }
    const colors = CreateRandomColors();
    let userColors = this.context.userColors;
    lobbies.forEach((lobby) => {
      lobby.users?.forEach((user) => {
        if (!userColors[user.username]) {
          userColors[user.username] = colors[(Object.keys(userColors).length) % colors.length];
        }
      });
    });
    this.context.setUserColors(userColors);
  }

  handleNewUser = (updatedLobby) => {
    const { lobbies } = this.state;
    if (!updatedLobby.users || !updatedLobby || !lobbies.find((lobby) => lobby.id === updatedLobby.id)) {
      return;
    }
    lobbies.find((lobby) => lobby.id === updatedLobby.id).users = updatedLobby.users;
    this.createUserColors(lobbies);
    this.setState({ lobbies });
  }

  handleRemoveLobby = (lobby) => {
    const { lobbies } = this.state;
    lobbies.splice(lobbies.indexOf(lobby), 1);
    this.setState({ lobbies });
  }

  handlePinLobby = (lobby) => {
    let { pinnedLobbies } = this.state;
    if (pinnedLobbies.includes(lobby)) {
      pinnedLobbies.splice(pinnedLobbies.indexOf(lobby), 1);
      RemovePinnedLobbyFromUserFile(lobby.id);
    } else {
      pinnedLobbies = [lobby].concat(pinnedLobbies);
      AddPinnedLobbyToUserFile(lobby.id);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.easeInEaseOut();
    this.setState({ lobbies: this.sortLobbies(this.state.lobbies, pinnedLobbies), pinnedLobbies });
  }

  loadLobbies = async () => {
    this.setState({ loading: true });
    let lobbyIds = [];
    await FileSystem.readAsStringAsync(UserFilePath).then(res => {
      pinnedLobbyIds = JSON.parse(res).pinnedLobbies;
      lobbyIds = JSON.parse(res).lobbies;
    });
    let lobbyBuilder = [];
    let lobbyRef = firebase.database().ref("Lobby");
    let promises = lobbyIds.map(async (lobbyId) => {
      return lobbyRef.child(lobbyId).once('value').catch(() => {
        console.log("invlaid lobby:" + lobbyId);
      });
    });
    Promise.all(promises).then((snapshots) => {
      snapshots.forEach((lobby) => {
        lobbyBuilder.push({ "id": lobby.key, ...lobby.val() });
      });
      this.createUserColors(lobbyBuilder);
      let pinnedLobbies = [];
      pinnedLobbyIds.forEach((lobbyId) => {
        pinnedLobbies.push(lobbyBuilder[lobbyIds.indexOf(lobbyId)]);
      });
      this.setState({ lobbies: this.sortLobbies(lobbyBuilder.reverse(), pinnedLobbies), loading: false, pinnedLobbies });
    });
  }

  sortLobbies = (lobbies, pinnedLobbies) => {
    let unPinnedLobbies = [];
    lobbies.forEach((lobby) => {
      if (!pinnedLobbies.includes(lobby)) {
        unPinnedLobbies.push(lobby);
      }
    });

    return pinnedLobbies.concat(unPinnedLobbies);
  }

  generateLobbyCode = () => {
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);
    return (firstPart + secondPart);
  }

  handleLobbyCodeChange = (lobbyCode) => {
    this.setState({ lobbyCode });
  };

  handleLobbyNameChange = (lobbyName) => {
    this.setState({ lobbyName });
  }

  handleCreateLobbyClick = () => {
    this.setState({ createLobbyToggled: true });
  };

  createLobby = async () => {
    this.setState({ loading: true });
    const { user } = this.props.route.params;
    const lobbyRef = await firebase.database().ref("Lobby").push();
    const lobby = {
      "active": true,
      "name": this.state.lobbyName,
      "code": this.generateLobbyCode(),
      "createdBy": user.username,
      "users": [
        {
          id: user.id,
          username: user.username,
        }
      ]
    }
    await lobbyRef.set(lobby);
    let lobbyId = lobbyRef.toString().replace("https://social-jbm-default-rtdb.firebaseio.com/Lobby/", "");
    await this.addLobbyToUser(lobbyId);
    const newLobby = {
      ...lobby,
      id: lobbyId
    }
    let newLobbies = this.state.lobbies;
    newLobbies = [newLobby].concat(newLobbies);
    this.setState({ createLobbyToggled: false, loading: false, lobbies: this.sortLobbies(newLobbies, this.state.pinnedLobbies) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.props.navigation.push("LobbyScreen", { lobby: newLobby, user: this.props.route.params.user, handleNewUser: this.handleNewUser, handleRemoveLobby: this.handleRemoveLobby });
  }

  joinLobby = async () => {
    const { user } = this.props.route.params;
    let { lobbyCode } = this.state;
    lobbyCode = lobbyCode?.trim();
    if (lobbyCode.length === 0) {
      this.setState({ lobbyDoesNotExist: false, lobbyCode: "" });
    }
    if (lobbyCode.length !== 6) {
      console.log("Invalid lobby code.");
      this.setState({ lobbyDoesNotExist: true });
      return;
    }
    this.setState({ loading: true });
    await firebase.database().ref("Lobby").orderByChild('code').equalTo(lobbyCode.toLocaleLowerCase()).once('value').then(async (lobby) => {
      if (JSON.stringify(lobby) !== 'null') {
        this.setState({ lobbyCode: "", lobbyDoesNotExist: false });
        let validLobby;
        lobby.forEach(element => {
          validLobby = { ...element.val(), id: element.key };
        });
        if (!validLobby.active) {
          this.setState({ lobbyDoesNotExist: true, lobbyCode: "", loading: false });
          return;
        }
        const lobbyRef = firebase.database().ref("Lobby/" + validLobby.id);
        await lobbyRef.transaction((lobby) => {
          if (lobby) {
            if (!lobby.users.find(u => u.username === user.username)) {
              if (!lobby.users) {
                lobby.users = [];
              }
              lobby.users.push({ username: user.username, id: user.id });
            }
          }
          return lobby;
        });
        await this.addLobbyToUser(validLobby.id);
        if (!this.state.lobbies.find(l => l.id === validLobby.id)) {
          this.createUserColors([validLobby].concat(this.state.lobbies));
          this.setState({ lobbies: this.sortLobbies([validLobby].concat(this.state.lobbies), this.state.pinnedLobbies) });
        }
        this.setState({ loading: false });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        this.props.navigation.push("LobbyScreen", { lobby: validLobby, user: this.props.route.params.user, handleNewUser: this.handleNewUser, handleRemoveLobby: this.handleRemoveLobby });
      } else {
        this.setState({ lobbyDoesNotExist: true, lobbyCode: "", loading: false });
      }
    });

  };

  /**
   * Returns true if new relationship, false if duplicate.
   * @param {string} lobbyId 
   */
  addLobbyToUser = async (lobbyId) => {
    return await AddLobbyToUserFile(lobbyId);
  }

  renderLobbyCard = (lobby) => {
    const { pinnedLobbies } = this.state;
    return (
      <TouchableHighlight onPress={() => {
        this.props.navigation.push("LobbyScreen", { lobby, user: this.props.route.params.user, handleNewUser: this.handleNewUser, handleRemoveLobby: this.handleRemoveLobby });
      }}
      onLongPress={() => this.handlePinLobby(lobby)}
      delayLongPress={350}
      delayPressOut={0}
      delayPressIn={0}
      style={styles.cardWrapper}
      >
        <View style={styles.card}>
          <View style={styles.pressablePinIcon}>
            <Icon name={pinnedLobbies.includes(lobby) ? 'star' : 'staro'} type="antdesign" size={20} color={pinnedLobbies.includes(lobby) ? ThemeColors.border : 'black'} style={styles.pinIconBottom} onPress={() => this.handlePinLobby(lobby)} />
          </View>
          <View style={styles.lobbyNameView}>
            <Text style={[styles.lobbyName, { fontFamily: 'Audio-Wide' }]}>{lobby.name}</Text>
          </View>
          <View>
            <Text style={styles.lobbyCode}>{lobby.code.toUpperCase()}</Text>
            <UserList users={lobby.users} colors={this.context.userColors} onCard />
          </View>
        </View>
      </TouchableHighlight>
    );
  };

  render() {
    const { loading, lobbies, lobbyCode, lobbyDoesNotExist, lobbyName, createLobbyToggled } = this.state;
    const header = (
      <View style={[styles.container, {backgroundColor: this.props.theme.colors.background}]} >
        <View style={{ alignSelf: 'center', marginBottom: 10 }}>
          <Image 
            source={require('../assets/vow-text-small-2.png')}
            style={{ width: 130, height: 50 }}
          />
        </View>
        <View style={styles.button}>
          <Button onPress={this.handleCreateLobbyClick} title="Start Lobby" />
        </View>
        <View style={styles.row}>
          <View style={styles.codeInput}>
            <Input
              style={styles.codeInput}
              placeholder="Lobby Code"
              onChangeText={this.handleLobbyCodeChange}
              value={lobbyCode}
              errorMessage={lobbyDoesNotExist ? "Invalid code. Please try again" : null}
              errorStyle={styles.codeInputError}
              onSubmitEditing={this.joinLobby}
              placeholderTextColor={ThemeColors.border}
            />
          </View>
          <View style={styles.codeButton}>
            <Button
              disabled={!lobbyCode}
              onPress={this.joinLobby}
              title="Join"
            />
          </View>
        </View>
      </View>
    );
    const listBottomPadding = <View style={{ paddingBottom: 10 }} />;

    return this.state.fontsLoaded ? (
      <SafeAreaView>
        <StatusBar backgroundColor={ThemeColors.background} barStyle="light-content" />
        <LoadingSpinner spinning={loading} />
        <Overlay isVisible={createLobbyToggled} onBackdropPress={() => { this.setState({ createLobbyToggled: false }) }} overlayStyle={styles.createLobbyOverlay}>
          <View>
            <Input
              style={styles.codeInput}
              placeholder="Lobby Name"
              onChangeText={this.handleLobbyNameChange}
              placeholderTextColor={ThemeColors.border}
            />
            <View style={styles.createLobbyButton}>
              <Button
                disabled={!lobbyName}
                onPress={this.createLobby}
                title="Create Lobby"
              />
            </View>
          </View>
        </Overlay>
        <View style={styles.list}>
          <FlatList
            ListHeaderComponent={header}
            ListFooterComponent={listBottomPadding}
            stickyHeaderIndices={[0]}
            data={lobbies}
            renderItem={({ item }) => this.renderLobbyCard(item)}
            keyExtractor={(lobby) => lobby.code}
          />
        </View>
      </SafeAreaView>
    ) : <View></View>;
  }
}

Home.contextType = UserColors;

export default (props) => {
  const theme = useTheme();

  return <Home {...props} theme={theme} />
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
    paddingLeft: 20,
    paddingRight: 20,
    marginBottom: 10
  },
  card: {
    borderWidth: 1.3,
    padding: 15,
    backgroundColor: ThemeColors.card,
    borderColor: ThemeColors.border,
    borderRadius: 8,
  },
  cardWrapper: {
    marginHorizontal: 15, 
    marginTop: 15,
    borderRadius: 8,
  },
  button: {
    width: '100%',
    marginBottom: 20,
    alignSelf: 'center',
  },
  codeInput: {
    width: '60%',
  },
  codeInputError: {
    margin: 0,
  },
  codeButton: {
    width: '37%',
    marginLeft: 10,
  },
  row: {
    flexDirection: 'row',
  },
  list: {
    paddingBottom: 0,
    height: '100%',
  },
  createLobbyOverlay: {
    width: '80%',
    borderColor: ThemeColors.border,
    borderWidth: 2,
    borderRadius: 8,
  },
  createLobbyButton: {
    width: '100%',
    paddingTop: 5,
  },
  lobbyCode: {
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 5,
  },
  pressablePinIcon: {
    alignSelf: 'flex-end',
    marginTop: -25,
    marginRight: -25,
    padding: 20,
  },
  lobbyNameView: {
    fontSize: 15,
    marginTop: -20
  },
  lobbyName: {
    textAlign: 'center',
    fontSize: 17,
    color: ThemeColors.textTitle,
    textShadowColor: ThemeColors.textTitle,
    textShadowRadius: 6,
  },

});
