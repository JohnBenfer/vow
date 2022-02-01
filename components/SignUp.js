import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { Input, Button } from 'react-native-elements';
import LoadingSpinner from './LoadingSpinner';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as firebase from 'firebase';
import {ReadUserFromFile, WriteUserToFile} from '../Util';
import {UserFilePath} from '../Constants';
import * as SplashScreen from 'expo-splash-screen';

let user;

class SignUp extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      username: "",
      usernameAlreadyExists: false,
      loading: false,
      error: false,
    };
  }

  async componentDidMount() {
    
    // this.deleteUserFile();
    // await this.removeLobbiesFromFile();
    // await this.removeBetsFromFile();
    if (await this.isUser()) {
      this.setState({ loading: true });
      console.log("user from file: ");
      console.log(user);
      await firebase.auth().signInAnonymously()
        .then(async () => {
          // Signed in..
          this.props.navigation.navigate('Root', { user });
        })
        .catch((error) => {
          console.log(error.code);
          console.log(error.message);
        });
      this.setState({ loading: false });
    } else {
      SplashScreen.hideAsync();
    }
  }

  isUser = async () => {
    let exists = false;
    this.setState({ loading: true });
    await FileSystem.readAsStringAsync(UserFilePath).then(async (res) => {
      user = JSON.parse(res);
      await firebase.database().ref('User/' + user.id).once('value').then((user) => {
        (JSON.stringify(user) !== 'null' && user) ? exists = true : exists = false;
        if (!exists) {
          this.deleteUserFile();
        }
      }).catch(() => {
        console.log('error finding user in db');
      });
    }).catch(err => {
      console.log('error reading userdata file');
      console.log(err);
    });
    this.setState({ loading: false });
    return exists;
  }

  deleteUserFile = async () => {
    await FileSystem.deleteAsync(UserFilePath).then(res => {
      console.log("userdata deleted");
    });
  }

  removeLobbiesFromFile = async () => {
    let user;
    await FileSystem.readAsStringAsync(UserFilePath).then(res => {
      console.log(JSON.parse(res));
      user = JSON.parse(res);
    })
    const newUser = {
      ...user,
      lobbies: [],
      pinnedLobbies: [],
    };
    console.log("new user without lobbies");
    console.log(newUser);
    await WriteUserToFile(newUser);
  }

  removeBetsFromFile = async () => {
    let user;
    await FileSystem.readAsStringAsync(UserFilePath).then(res => {
      console.log(JSON.parse(res));
      user = JSON.parse(res);
    });
    const newUser = {
      ...user,
      bets: []
    };
    console.log("new user without bets");
    console.log(newUser);
    await WriteUserToFile(newUser);
  }

  createUser = async () => {
    this.setState({ loading: true });
    let users;
    await firebase.auth().signInAnonymously();
    let userRef = await firebase.database().ref("User");
    await userRef.orderByChild('username').equalTo(this.state.username).once('value').then((user) => {
      console.log("existing users:");
      console.log(user);
      users = user;
    });
    console.log("existing users object:");
    console.log(JSON.stringify(users));
    let usersString = JSON.stringify(users);
    if (!usersString || usersString === 'null') {
      this.setState({ usernameAlreadyExists: false });
      let userRef = firebase.database().ref("User").push();
      console.log("New user ref:");
      console.log(userRef);
      (await userRef).set({
        username: this.state.username
      }).then((res) => {
        // const userId = userRef.toString().substr(userRef.lastIndexOf('/')+1, userRef.length);
        const userId = userRef.toString().replace("https://social-jbm-default-rtdb.firebaseio.com/User/", "");
        let newUserObject = {
          "username": this.state.username,
          "id": userId,
          "lobbies": [],
          "pinnedLobbies": [],
          "bets": [],
        }
        console.log("new user object:");
        console.log(newUserObject);
        FileSystem.writeAsStringAsync(UserFilePath, JSON.stringify(newUserObject)).then(res => {
          this.setState({ loading: false });
          this.props.navigation.navigate('Root', { user: newUserObject });
        }).catch(err => {
          console.log('error writing file');
          console.log(err);
          // delete user from db when write to file fails
          userRef.remove().then(() => {
            console.log(userId + ' user removed from db');
            this.setState({ loading: false, error: true, username: '' });
          });
        });
      }).catch((err) => {
        console.log("error creating user in db");
        console.log(err);
        this.setState({ loading: false, error: true, username: '' });
        // erase user from file
        WriteUserToFile('');
      });
      this.setState({ usernameAlreadyExists: false, loading: false });
    } else {
      // this user already exists
      console.log("user already exists");
      this.setState({ usernameAlreadyExists: true, loading: false });
    }
  }

  getErrorMessage = () => {
    if(this.state.usernameAlreadyExists) {
      return 'That username already exists. Please enter another one.';
    } else if(this.state.error) {
      return 'Error creating user.';
    } else {
      return null;
    }
  }

  handleUsernameChange = (username) => {
    this.setState({ username, usernameAlreadyExists: false, error: false });
  }

  render() {
    const { loading, username, usernameAlreadyExists, error } = this.state;
    return (
      <SafeAreaView>
        <LoadingSpinner spinning={loading} />
        <View style={styles.container}>
          <Input
            label="Username"
            placeholder="Username"
            onChangeText={this.handleUsernameChange}
            errorMessage={this.getErrorMessage()}
            maxLength={20}
          />
          <Button disabled={!username || error} onPress={this.createUser} title="Sign up" style={styles.button} />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    marginTop: Constants.statusBarHeight + 50,
    paddingLeft: 20,
    paddingRight: 20,
    height: '100%',
  },
  button: {
    width: '100%',
    marginTop: 20,
    alignSelf: 'center',
  }
});

export default SignUp;