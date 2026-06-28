import { useRouter } from 'expo-router';
import LoginScreen from '../screens/LoginScreen';

export default function LoginPage() {
  const router = useRouter();

  const navigation = {
    replace: (_screen: string) => router.replace('/(drawer)/dashboard'),
    navigate: (_screen: string) => router.push('/register'),
  };

  return <LoginScreen navigation={navigation} />;
}